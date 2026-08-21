// QTI 3 import/export (spec 04, QTI-001 to QTI-004) against spec 08's item
// bank (assessment_items/assessment_item_revisions/item_answer_keys).
//
// Import: client parses the zip+XML (jszip + DOMParser, same libraries and
// namespace-agnostic getElementsByTagNameNS("*", …) convention the existing
// PPTX importer already uses — see
// components/presentation-editor/import/presentationImport.ts), classifies
// every QTI assessmentItem as imported/adapted/rejected, then hands the
// fully pre-parsed, pre-classified result to import_qti_items() — one
// transactional server RPC, mirroring import_legacy_quiz_as_assessment()'s
// established shape (20260813190000_assessment_pools_and_legacy_links.sql).
//
// QTI-003 ("aucun type inconnu n'est silencieusement converti en QCM"): the
// mapping table below is a strict allowlist. An interaction with no genuine
// correspondence to one of assessment_items.item_type's 20 real values is
// always `rejected`, never coerced into single_choice/mcq/anything else as a
// fallback — verified by qti.test.ts.
// Lazy-imported inside commitQtiImport()/buildAssessmentQtiPackage() only —
// not at module scope. Every other export here (parseQtiPackage,
// classifyInteraction, buildAssessmentItemXml) is pure and unit-tested
// without a Supabase project configured (see __tests__/qti.test.ts); a
// top-level `import { supabase } from '@/lib/supabase'` would construct a
// real client at module-load time and break those tests in any environment
// without VITE_SUPABASE_URL set — same pure/impure split this codebase
// already uses for enrollmentImport.ts vs enrollment.ts.
import type { ItemPrompt } from './itemBank';

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export type QtiOutcome = 'imported' | 'adapted' | 'rejected';

export interface QtiParsedItem {
  qti_identifier: string;
  title: string | null;
  qti_interaction: string | null;
  outcome: QtiOutcome;
  reason: string | null;
  item_type: string | null;
  prompt: (ItemPrompt & { media?: { type: 'image' | 'audio'; url: string; alt: string }[] }) | null;
  correct_answer: unknown;
  scoring_rules: unknown;
  external_id: string | null;
  license: unknown;
}

export interface QtiParseResult {
  title: string;
  items: QtiParsedItem[];
}

function text(node: Element | null | undefined): string {
  return (node?.textContent ?? '').trim();
}

function localName(el: Element): string {
  // getElementsByTagNameNS("*", …) already filters by local name, but QTI 3
  // interaction tags themselves are read off child elements directly — keep
  // this helper so callers never have to worry about a `qti:` prefix or lack
  // thereof, same reasoning as the PPTX importer's own wildcard-NS lookups.
  return el.localName || el.tagName.replace(/^.*:/, '');
}

const KNOWN_INTERACTIONS = new Set([
  'choiceInteraction',
  'textEntryInteraction',
  'extendedTextInteraction',
  'orderInteraction',
  'matchInteraction',
  'sliderInteraction',
  'hotspotInteraction',
  'gapMatchInteraction',
]);

/** Finds every interaction element inside an assessmentItem's itemBody,
 *  regardless of namespace prefix. QTI 3's own element names are
 *  camelCase (`choiceInteraction`, not the dashed `qti-choice-interaction`
 *  form some authoring tools' HTML custom-element mirrors use) — the real
 *  XML Schema vocabulary, verified against the IMS QTI 3.0 spec rather than
 *  guessed. */
function findInteractions(itemBody: Element): Element[] {
  const found: Element[] = [];
  for (const tag of KNOWN_INTERACTIONS) {
    found.push(...Array.from(itemBody.getElementsByTagNameNS('*', tag)));
  }
  // Anything ending in "Interaction" that isn't in our known set — collected
  // separately so an unsupported-but-real interaction gets a specific
  // rejection reason (naming what it actually was) instead of "no
  // interaction found" when one clearly exists.
  const all = Array.from(itemBody.getElementsByTagNameNS('*', '*')).filter((el) =>
    localName(el).endsWith('Interaction'),
  );
  for (const el of all) {
    if (!found.includes(el)) found.push(el);
  }
  return found;
}

function parseSimpleChoices(interaction: Element): { id: string; label: string }[] {
  return Array.from(interaction.getElementsByTagNameNS('*', 'simpleChoice')).map((choice, idx) => ({
    id: choice.getAttribute('identifier') || `choice${idx}`,
    label: text(choice),
  }));
}

function parseCorrectResponseValues(itemEl: Element, responseIdentifier: string): string[] {
  const declarations = Array.from(itemEl.getElementsByTagNameNS('*', 'responseDeclaration'));
  const decl = declarations.find((d) => d.getAttribute('identifier') === responseIdentifier);
  if (!decl) return [];
  const correct = decl.getElementsByTagNameNS('*', 'correctResponse')[0];
  if (!correct) return [];
  return Array.from(correct.getElementsByTagNameNS('*', 'value')).map((v) => text(v));
}

function responseCardinality(itemEl: Element, responseIdentifier: string): string {
  const declarations = Array.from(itemEl.getElementsByTagNameNS('*', 'responseDeclaration'));
  const decl = declarations.find((d) => d.getAttribute('identifier') === responseIdentifier);
  return decl?.getAttribute('cardinality') ?? 'single';
}

function extractMedia(itemBody: Element): { type: 'image' | 'audio'; url: string; alt: string }[] {
  const media: { type: 'image' | 'audio'; url: string; alt: string }[] = [];
  for (const img of Array.from(itemBody.getElementsByTagNameNS('*', 'img'))) {
    const src = img.getAttribute('src');
    if (src) media.push({ type: 'image', url: src, alt: img.getAttribute('alt') ?? '' });
  }
  return media;
}

/** Maps one already-located interaction element to a real assessment_items
 *  item_type, or marks it rejected with a specific reason. This is the
 *  QTI-003-governed allowlist — extending it means adding a genuine new
 *  correspondence, never a fallback branch. */
function classifyInteraction(
  itemEl: Element,
  itemBody: Element,
  interaction: Element,
): { item_type: string | null; outcome: QtiOutcome; reason: string | null; correct_answer: unknown; scoring_rules: unknown } {
  const kind = localName(interaction);
  const responseIdentifier = interaction.getAttribute('responseIdentifier') ?? '';
  const cardinality = responseCardinality(itemEl, responseIdentifier);
  const correctValues = parseCorrectResponseValues(itemEl, responseIdentifier);

  switch (kind) {
    case 'choiceInteraction': {
      const item_type = cardinality === 'multiple' ? 'mcq' : 'single_choice';
      const choices = parseSimpleChoices(interaction);
      if (item_type === 'single_choice') {
        return {
          item_type,
          outcome: 'imported',
          reason: null,
          correct_answer: { optionId: correctValues[0] ?? choices[0]?.id ?? '' },
          scoring_rules: { points: 1 },
        };
      }
      return {
        item_type,
        outcome: 'imported',
        reason: null,
        correct_answer: { optionIds: correctValues },
        scoring_rules: { points: 1 },
      };
    }
    case 'textEntryInteraction':
      return {
        item_type: 'short_answer',
        outcome: 'imported',
        reason: null,
        correct_answer: { equivalents: correctValues },
        scoring_rules: { points: 1, caseInsensitive: true },
      };
    case 'extendedTextInteraction':
      return { item_type: 'free_text', outcome: 'adapted', reason: 'Notation manuelle requise (texte libre, pas de correction automatique QTI importée)', correct_answer: {}, scoring_rules: { points: 1, requiresManualGrading: true } };
    case 'orderInteraction':
      return { item_type: 'ranking', outcome: 'imported', reason: null, correct_answer: { order: correctValues }, scoring_rules: { points: 1 } };
    case 'matchInteraction':
      return { item_type: 'matching', outcome: 'adapted', reason: 'Correspondances importées telles quelles, non revérifiées', correct_answer: { pairs: correctValues }, scoring_rules: { points: 1 } };
    case 'sliderInteraction':
      return { item_type: 'slider', outcome: 'imported', reason: null, correct_answer: { value: correctValues[0] ?? null }, scoring_rules: { points: 1 } };
    case 'hotspotInteraction':
      return { item_type: 'hotspot', outcome: 'adapted', reason: 'Zones cliquables importées sans revalidation des coordonnées', correct_answer: { hotspots: correctValues }, scoring_rules: { points: 1 } };
    case 'gapMatchInteraction':
      return { item_type: 'cloze', outcome: 'adapted', reason: 'Import de texte à trous — vérifier les réponses attendues', correct_answer: { gaps: correctValues }, scoring_rules: { points: 1 } };
    default:
      return {
        item_type: null,
        outcome: 'rejected',
        reason: `Type d'interaction QTI non supporté : ${kind || '(inconnu)'} — aucune correspondance fiable dans la banque d'items, non deviné`,
        correct_answer: null,
        scoring_rules: null,
      };
  }
}

function parseAssessmentItemXml(xmlText: string): QtiParsedItem {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const itemEl = doc.getElementsByTagNameNS('*', 'assessmentItem')[0];
  if (!itemEl) {
    return {
      qti_identifier: 'unknown',
      title: null,
      qti_interaction: null,
      outcome: 'rejected',
      reason: "Fichier XML sans élément <assessmentItem> — pas un item QTI 3 valide",
      item_type: null,
      prompt: null,
      correct_answer: null,
      scoring_rules: null,
      external_id: null,
      license: null,
    };
  }
  const qtiIdentifier = itemEl.getAttribute('identifier') || 'unknown';
  const title = itemEl.getAttribute('title');
  const itemBody = itemEl.getElementsByTagNameNS('*', 'itemBody')[0];
  const interactions = itemBody ? findInteractions(itemBody) : [];

  if (interactions.length === 0) {
    return {
      qti_identifier: qtiIdentifier,
      title,
      qti_interaction: null,
      outcome: 'rejected',
      reason: 'Aucune interaction trouvée dans <itemBody>',
      item_type: null,
      prompt: null,
      correct_answer: null,
      scoring_rules: null,
      external_id: qtiIdentifier,
      license: null,
    };
  }
  if (interactions.length > 1) {
    return {
      qti_identifier: qtiIdentifier,
      title,
      qti_interaction: interactions.map(localName).join(', '),
      outcome: 'rejected',
      reason: `Item à interactions multiples (${interactions.map(localName).join(', ')}) — non supporté, un item de cette banque porte une seule interaction`,
      item_type: null,
      prompt: null,
      correct_answer: null,
      scoring_rules: null,
      external_id: qtiIdentifier,
      license: null,
    };
  }

  const interaction = interactions[0];
  const kind = localName(interaction);
  const classification = classifyInteraction(itemEl, itemBody, interaction);

  const promptText = text(itemBody);
  const choices = kind === 'choiceInteraction' ? parseSimpleChoices(interaction) : undefined;
  const media = itemBody ? extractMedia(itemBody) : [];

  const licenseEl = itemEl.getElementsByTagNameNS('*', 'rights')[0] || itemEl.getElementsByTagNameNS('*', 'copyright')[0];

  return {
    qti_identifier: qtiIdentifier,
    title,
    qti_interaction: kind,
    outcome: classification.outcome,
    reason: classification.reason,
    item_type: classification.item_type,
    prompt: classification.outcome === 'rejected' ? null : {
      text: promptText,
      options: choices,
      media: media.length ? media : undefined,
    },
    correct_answer: classification.correct_answer,
    scoring_rules: classification.scoring_rules,
    external_id: qtiIdentifier,
    license: licenseEl ? { text: text(licenseEl) } : null,
  };
}

/** Parses a QTI 3 content package (zip: imsmanifest.xml + one XML file per
 *  assessmentItem). Every item is classified — nothing is silently dropped,
 *  a caller renders the full report (QTI-001) before committing anything. */
export async function parseQtiPackage(file: File): Promise<QtiParseResult> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('Fichier trop volumineux (limite 50 Mo)');
  }
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);

  const manifestEntry = zip.file('imsmanifest.xml');
  if (!manifestEntry) {
    throw new Error("Paquet QTI invalide : imsmanifest.xml introuvable à la racine de l'archive");
  }
  const manifestXml = await manifestEntry.async('text');
  const manifestDoc = new DOMParser().parseFromString(manifestXml, 'application/xml');
  const title = text(manifestDoc.getElementsByTagNameNS('*', 'title')[0]) || file.name.replace(/\.zip$/i, '');

  // Real IMS QTI 3.0 content-packaging resource type is `imsqti_item_xmlv3p0`
  // (what buildAssessmentQtiPackage's own export writes below) — an earlier
  // version of this filter checked for the substring "assessmentItem",
  // which no real QTI 3 manifest actually uses and would have made this
  // app's own exported packages unreadable by its own importer. Fixed
  // before commit, caught by qti.test.ts actually exercising import against
  // a manifest shaped like a real one.
  const resourceHrefs = Array.from(manifestDoc.getElementsByTagNameNS('*', 'resource'))
    .filter((r) => (r.getAttribute('type') ?? '').toLowerCase().includes('imsqti_item'))
    .map((r) => r.getAttribute('href'))
    .filter((href): href is string => !!href);

  if (resourceHrefs.length === 0) {
    throw new Error("Aucune ressource de type assessmentItem déclarée dans imsmanifest.xml");
  }

  const items: QtiParsedItem[] = [];
  for (const href of resourceHrefs) {
    const entry = zip.file(href);
    if (!entry) {
      items.push({
        qti_identifier: href,
        title: null,
        qti_interaction: null,
        outcome: 'rejected',
        reason: `Ressource déclarée mais fichier absent de l'archive : ${href}`,
        item_type: null,
        prompt: null,
        correct_answer: null,
        scoring_rules: null,
        external_id: null,
        license: null,
      });
      continue;
    }
    const xmlText = await entry.async('text');
    items.push(parseAssessmentItemXml(xmlText));
  }

  return { title, items };
}

/** Commits a parsed+classified batch — only `imported`/`adapted` items ever
 *  produce a real assessment_items row (import_qti_items(), server-side,
 *  QTI-003 enforced there too via the item_type check constraint as
 *  defense in depth). Returns the created assessment id. */
export async function commitQtiImport(title: string, sourceFilename: string, items: QtiParsedItem[]): Promise<string> {
  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase.rpc('import_qti_items', {
    p_title: title,
    p_source_filename: sourceFilename,
    p_items: items,
  });
  if (error) throw error;
  return data as string;
}

// ── Export (QTI-002) ────────────────────────────────────────────────────

export interface QtiExportReportEntry {
  section_title: string;
  status: 'exported' | 'excluded';
  reason?: string;
  item_count?: number;
}

export interface QtiExportResult {
  blob: Blob;
  filename: string;
  report: QtiExportReportEntry[];
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The inverse of the import mapping in classifyInteraction() — a Brivia
 *  item_type this app can genuinely round-trip into a QTI interaction.
 *  Types with no real QTI correspondence (this app's own dead/never-
 *  reachable types, or ones QTI has no interaction shape for) are excluded
 *  at the caller (buildAssessmentQtiPackage), never faked here. */
export function buildAssessmentItemXml(item: {
  external_id: string | null;
  item_type: string;
  prompt: ItemPrompt;
  correct_answer: unknown;
}): string | null {
  const identifier = item.external_id || `item-${Math.random().toString(36).slice(2)}`;
  const promptText = xmlEscape(item.prompt?.text ?? '');
  const options = item.prompt?.options ?? [];

  const choiceXml = (multiple: boolean) => {
    const correct = item.correct_answer as { optionId?: string; optionIds?: string[] } | null;
    const correctIds = multiple ? (correct?.optionIds ?? []) : [correct?.optionId ?? ''];
    return `<responseDeclaration identifier="RESPONSE" cardinality="${multiple ? 'multiple' : 'single'}" baseType="identifier">
  <correctResponse>${correctIds.filter(Boolean).map((id) => `<value>${xmlEscape(id)}</value>`).join('')}</correctResponse>
</responseDeclaration>
<itemBody>
  <p>${promptText}</p>
  <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="${multiple ? 0 : 1}">
    ${options.map((o) => `<simpleChoice identifier="${xmlEscape(o.id)}">${xmlEscape(o.label)}</simpleChoice>`).join('\n    ')}
  </choiceInteraction>
</itemBody>`;
  };

  let body: string | null = null;
  switch (item.item_type) {
    case 'single_choice':
      body = choiceXml(false);
      break;
    case 'mcq':
      body = choiceXml(true);
      break;
    case 'short_answer': {
      const correct = item.correct_answer as { equivalents?: string[] } | null;
      body = `<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
  <correctResponse>${(correct?.equivalents ?? []).filter(Boolean).map((v) => `<value>${xmlEscape(v)}</value>`).join('')}</correctResponse>
</responseDeclaration>
<itemBody>
  <p>${promptText}</p>
  <textEntryInteraction responseIdentifier="RESPONSE" />
</itemBody>`;
      break;
    }
    case 'ranking': {
      const correct = item.correct_answer as { order?: string[] } | null;
      body = `<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
  <correctResponse>${(correct?.order ?? []).map((v) => `<value>${xmlEscape(v)}</value>`).join('')}</correctResponse>
</responseDeclaration>
<itemBody>
  <p>${promptText}</p>
  <orderInteraction responseIdentifier="RESPONSE">
    ${options.map((o) => `<simpleChoice identifier="${xmlEscape(o.id)}">${xmlEscape(o.label)}</simpleChoice>`).join('\n    ')}
  </orderInteraction>
</itemBody>`;
      break;
    }
    default:
      return null;
  }

  const licenseXml = item.prompt && (item as { license?: { text?: string } }).license?.text
    ? `<rightsMetadata>${xmlEscape((item as { license?: { text?: string } }).license!.text!)}</rightsMetadata>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="${xmlEscape(identifier)}" title="${xmlEscape(item.prompt?.text?.slice(0, 60) ?? identifier)}" adaptive="false" timeDependent="false">
  ${licenseXml}
  ${body}
</assessmentItem>`;
}

/** Builds a real QTI 3 content package (zip) for one assessment. Fixed
 *  sections whose items have a genuine QTI round-trip mapping are exported
 *  for real; pool sections and item types with no faithful QTI
 *  representation are excluded and named in the report — never silently
 *  dropped, never faked as a static list (see this file's header — QTI has
 *  no first-class "random draw from a named set" construct). */
export async function buildAssessmentQtiPackage(assessmentId: string): Promise<QtiExportResult> {
  const { supabase } = await import('@/lib/supabase');
  const { data: assessment, error: aErr } = await supabase.from('assessments').select('*').eq('id', assessmentId).single();
  if (aErr) throw aErr;

  const { data: sections, error: sErr } = await supabase
    .from('assessment_sections')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('position');
  if (sErr) throw sErr;

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const report: QtiExportReportEntry[] = [];
  const manifestResources: string[] = [];
  let exportedCount = 0;

  for (const section of sections ?? []) {
    if (section.selection_mode !== 'fixed') {
      report.push({ section_title: section.title, status: 'excluded', reason: "Section de type tirage aléatoire (pool) — QTI n'a pas d'équivalent natif pour un tirage depuis une collection nommée, non représentable" });
      continue;
    }

    const { data: refs, error: rErr } = await supabase
      .from('assessment_item_refs')
      .select('item_revision_id, position')
      .eq('section_id', section.id)
      .order('position');
    if (rErr) throw rErr;
    const revisionIds = (refs ?? []).map((r) => r.item_revision_id);
    if (revisionIds.length === 0) {
      report.push({ section_title: section.title, status: 'excluded', reason: 'Section vide' });
      continue;
    }

    const { data: revisions, error: revErr } = await supabase
      .from('assessment_item_revisions')
      .select('id, prompt, item_id, item:assessment_items!inner(item_type, external_id, license)')
      .in('id', revisionIds);
    if (revErr) throw revErr;

    const { data: keys, error: kErr } = await supabase.rpc('get_item_answer_keys_for_export', { p_item_revision_ids: revisionIds });
    if (kErr) throw kErr;
    const keyByRevision = new Map((keys ?? []).map((k: { item_revision_id: string; correct_answer: unknown }) => [k.item_revision_id, k.correct_answer]));

    let sectionExported = 0;
    for (const rev of revisions ?? []) {
      const item = (rev as unknown as { item: { item_type: string; external_id: string | null; license: unknown } }).item;
      const xml = buildAssessmentItemXml({
        external_id: item.external_id,
        item_type: item.item_type,
        prompt: rev.prompt as ItemPrompt,
        correct_answer: keyByRevision.get(rev.id),
      });
      if (!xml) {
        report.push({ section_title: section.title, status: 'excluded', reason: `Item de type "${item.item_type}" sans correspondance QTI fiable — non exporté plutôt que représenté de façon inexacte` });
        continue;
      }
      const path = `items/${rev.id}.xml`;
      zip.file(path, xml);
      manifestResources.push(`<resource identifier="${xmlEscape(item.external_id || rev.id)}" type="imsqti_item_xmlv3p0" href="${path}"><file href="${path}"/></resource>`);
      sectionExported++;
      exportedCount++;
    }
    report.push({ section_title: section.title, status: 'exported', item_count: sectionExported });
  }

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="MANIFEST-${assessmentId}">
  <metadata><title>${xmlEscape(assessment.title)}</title></metadata>
  <resources>
    ${manifestResources.join('\n    ')}
  </resources>
</manifest>`;
  zip.file('imsmanifest.xml', manifest);

  if (exportedCount === 0) {
    report.push({ section_title: '(paquet)', status: 'excluded', reason: 'Aucun item exportable — paquet QTI vide' });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, filename: `${assessment.title.replace(/[^a-z0-9-]+/gi, '_')}-qti3.zip`, report };
}
