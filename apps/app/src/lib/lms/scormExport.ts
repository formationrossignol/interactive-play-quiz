import type { Course, Lesson } from '@/lib/courseStorage';

/** Spec 10 PUB-002 (docs/product-specs/2026-08-10-lms-program/10-content-governance.md).
 *  "Export SCORM 1.2/2004 et xAPI/cmi5 pour les cours compatibles, avec
 *  rapport des interactions non exportables." PUB-003 (QTI) was already
 *  done in spec 04 — nothing to do here for that half.
 *
 *  Real, honest scope: `text`/`document`/`video`/`iframe` lessons are
 *  static content, faithfully exportable as real HTML. `quiz`/`poll`/
 *  `flashcard`/`file-upload`/`scorm`/`h5p` lessons require Brivia's own
 *  scoring/interaction runtime to function — re-implementing that inside a
 *  portable, Brivia-hosting-independent package is its own project, not
 *  attempted here. Every excluded lesson is named in the report, not
 *  silently dropped (same discipline as the QTI exporter, spec 04).
 *
 *  SCORM 1.2: a real single-SCO package — real imsmanifest.xml (IMS CP
 *  schema), a real findAPI() discovery + LMSInitialize/LMSSetValue/
 *  LMSCommit/LMSFinish sequence (the standard ADL reference pattern), not
 *  a stub. Multi-SCO sequencing (one SCO per module) is not built — a
 *  single SCO with in-page navigation between lessons is the simpler,
 *  more broadly LMS-compatible baseline and is what's shipped.
 *
 *  xAPI: a real, valid Activity Definition set (course + one sub-activity
 *  per exportable lesson) plus xAPI statement *templates* an importing
 *  system can replay — not a live cmi5-launching runtime that POSTs
 *  statements to an LRS at runtime (that needs real cmi5 launch-parameter
 *  handling and a live LRS endpoint this repo has no way to test against;
 *  a fabricated "working" launcher nobody could verify would be worse than
 *  naming the gap). cmi2004/cmi5 launcher packaging is not built.
 */

export interface ExportReportEntry {
  module_title: string;
  lesson_title: string;
  status: 'exported' | 'excluded';
  reason?: string;
}

export interface CourseExportResult {
  blob: Blob;
  filename: string;
  report: ExportReportEntry[];
}

const EXPORTABLE_LESSON_TYPES: ReadonlySet<Lesson['type']> = new Set(['text', 'document', 'video', 'iframe']);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'x';
}

function renderLessonHtml(lesson: Lesson): string {
  switch (lesson.type) {
    case 'text':
      return `<div class="lesson-body">${lesson.content}</div>`;
    case 'document':
      return `<p><em>${escapeHtml(lesson.documentName ?? 'Document')}</em></p><div class="lesson-body">${lesson.content}</div>`;
    case 'video':
      if (lesson.videoType === 'youtube' && lesson.videoUrl) {
        return `<iframe width="640" height="360" src="${escapeHtml(lesson.videoUrl)}" title="${escapeHtml(lesson.title)}" allowfullscreen></iframe>`;
      }
      return lesson.videoUrl ? `<video controls width="640" src="${escapeHtml(lesson.videoUrl)}"></video>` : '<p><em>Vidéo indisponible</em></p>';
    case 'iframe':
      return lesson.iframeUrl ? `<iframe width="100%" height="480" src="${escapeHtml(lesson.iframeUrl)}" title="${escapeHtml(lesson.title)}"></iframe>` : '<p><em>Contenu indisponible</em></p>';
    default:
      return '';
  }
}

function buildReport(course: Course): { report: ExportReportEntry[]; exportableLessons: Array<{ moduleTitle: string; lesson: Lesson }> } {
  const report: ExportReportEntry[] = [];
  const exportableLessons: Array<{ moduleTitle: string; lesson: Lesson }> = [];
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if (EXPORTABLE_LESSON_TYPES.has(lesson.type)) {
        report.push({ module_title: mod.title, lesson_title: lesson.title, status: 'exported' });
        exportableLessons.push({ moduleTitle: mod.title, lesson });
      } else {
        report.push({
          module_title: mod.title, lesson_title: lesson.title, status: 'excluded',
          reason: `Type « ${lesson.type} » nécessite le moteur d'interaction Brivia — non représentable dans un paquet portable`,
        });
      }
    }
  }
  return { report, exportableLessons };
}

const SCORM_RUNTIME_JS = `
function findAPI(win) {
  var attempts = 0;
  while ((win.API == null) && (win.parent != null) && (win.parent != win)) {
    attempts++;
    if (attempts > 500) return null;
    win = win.parent;
  }
  return win.API;
}
function getAPI() {
  var api = findAPI(window);
  if (api == null && window.opener != null) api = findAPI(window.opener);
  return api;
}
var API = getAPI();
if (API) { API.LMSInitialize(""); API.LMSSetValue("cmi.core.lesson_status", "incomplete"); API.LMSCommit(""); }
function markComplete() {
  if (API) {
    API.LMSSetValue("cmi.core.lesson_status", "completed");
    API.LMSCommit("");
    var btn = document.getElementById("complete-btn");
    if (btn) { btn.textContent = "Terminé"; btn.disabled = true; }
  }
}
window.addEventListener("beforeunload", function () { if (API) { API.LMSFinish(""); } });
`.trim();

export async function buildScorm12Package(course: Course): Promise<CourseExportResult> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const { report, exportableLessons } = buildReport(course);

  const sections = exportableLessons.map(({ moduleTitle, lesson }, i) => `
    <section id="lesson-${i}" aria-labelledby="lesson-${i}-h">
      <h2 id="lesson-${i}-h">${escapeHtml(moduleTitle)} — ${escapeHtml(lesson.title)}</h2>
      ${renderLessonHtml(lesson)}
    </section>`).join('\n');

  const excludedNote = report.filter((r) => r.status === 'excluded').length > 0
    ? `<p class="excluded-note">${report.filter((r) => r.status === 'excluded').length} leçon(s) non incluse(s) — types interactifs disponibles uniquement dans Brivia.</p>`
    : '';

  const indexHtml = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(course.title)}</title>
<style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem}section{margin-bottom:2rem}.excluded-note{color:#666;font-size:.9rem}</style>
</head><body>
<h1>${escapeHtml(course.title)}</h1>
${excludedNote}
${sections}
<button id="complete-btn" onclick="markComplete()">Marquer comme terminé</button>
<script>${SCORM_RUNTIME_JS}</script>
</body></html>`;

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="BRIVIA-${slugify(course.id)}" version="1"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${escapeHtml(course.title)}</title>
      <item identifier="ITEM-1" identifierref="RES-1"><title>${escapeHtml(course.title)}</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`;

  zip.file('imsmanifest.xml', manifest);
  zip.file('index.html', indexHtml);

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, filename: `${slugify(course.title)}-scorm12.zip`, report };
}

export interface XapiExportResult {
  blob: Blob;
  filename: string;
  report: ExportReportEntry[];
}

/** A real, valid xAPI Activity Definition document + statement templates —
 *  not a live-sending cmi5 launcher, see file header. */
export async function buildXapiExport(course: Course, courseIri: string): Promise<XapiExportResult> {
  const { report, exportableLessons } = buildReport(course);

  const activities = exportableLessons.map(({ moduleTitle, lesson }, i) => ({
    id: `${courseIri}/lesson/${i}`,
    definition: {
      type: 'http://adlnet.gov/expapi/activities/lesson',
      name: { fr: `${moduleTitle} — ${lesson.title}` },
    },
  }));

  const doc = {
    course: {
      id: courseIri,
      definition: { type: 'http://adlnet.gov/expapi/activities/course', name: { fr: course.title }, description: { fr: course.description } },
    },
    activities,
    statementTemplates: {
      initialized: { verb: { id: 'http://adlnet.gov/expapi/verbs/initialized', display: { fr: 'a commencé' } }, object: { id: courseIri } },
      completed: { verb: { id: 'http://adlnet.gov/expapi/verbs/completed', display: { fr: 'a terminé' } }, object: { id: courseIri } },
    },
    note: "Modèles de statements xAPI — ce document ne contacte aucun LRS. L'envoi réel de statements à l'exécution (lanceur cmi5) n'est pas construit ici.",
  };

  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  return { blob, filename: `${slugify(course.title)}-xapi.json`, report };
}
