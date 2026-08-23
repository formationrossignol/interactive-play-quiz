import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, CheckCircle2, GitCommitVertical, Link2 as Link2Icon, MessageSquare, Package, Plus, Send, Upload, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { listRecentContent } from "@/lib/content/contentRepo";
import type { ContentRow } from "@/lib/content/types";
import { describeDiffChange, diffContentSnapshots } from "@/lib/lms/contentDiff";
import { listSessionsForContent, type CourseSession } from "@/lib/lms/enrollment";
import { buildPreviewLinkUrl, createPreviewLink, listPreviewLinks, revokePreviewLink, type PreviewLink } from "@/lib/lms/previewLinks";
import { buildScorm12Package, buildXapiExport, type ExportReportEntry } from "@/lib/lms/scormExport";
import type { Course } from "@/lib/courseStorage";
import {
  addContentComment,
  adoptContentDeploymentUpdate,
  checkContentDeploymentUpdate,
  createContentDeployment,
  listContentComments,
  listContentDeployments,
  listContentReleases,
  listContentVersions,
  listOpenReviewRequests,
  listReviewSteps,
  publishApprovedVersion,
  publishContentVersion,
  resolveContentComment,
  restoreContentVersion,
  saveContentDraft,
  submitContentForReview,
  submitReviewDecision,
  type ContentComment,
  type ContentDeployment,
  type ContentDeploymentUpdateCheck,
  type ContentRelease,
  type ContentVersion,
  type ReviewRequest,
  type ReviewStep,
} from "@/lib/lms/contentGovernance";

const STATUS_LABEL: Record<ContentVersion["status"], string> = {
  draft: "brouillon",
  in_review: "en revue",
  changes_requested: "changements demandés",
  approved: "approuvé",
  published: "publié",
  deprecated: "déprécié",
  archived: "archivé",
};

/** CNT-006 to CNT-010's review pipeline for one version: shows the open
 *  review request's decision trail and, for an 'in_review' version, the
 *  reviewer's approve/request-changes/comment form. Fetches lazily per
 *  version rather than joining server-side — only expanded versions need it. */
function ReviewPanel({ version, onDecided }: { version: ContentVersion; onDecided: () => void }) {
  const [request, setRequest] = useState<ReviewRequest | null | undefined>(undefined);
  const [steps, setSteps] = useState<ReviewStep[]>([]);
  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    listOpenReviewRequests(version.content_id)
      .then((all) => {
        const forThisVersion = all.find((r) => r.version === version.version) ?? null;
        setRequest(forThisVersion);
        return forThisVersion ? listReviewSteps(forThisVersion.id) : [];
      })
      .then(setSteps)
      .catch(showError);
  }, [version.content_id, version.version]);

  const handleDecide = async (decision: ReviewStep["decision"]) => {
    if (!request) return;
    setDeciding(true);
    try {
      await submitReviewDecision(request.id, decision, note.trim() || undefined);
      setNote("");
      onDecided();
    } catch (err) {
      showError(err);
    } finally {
      setDeciding(false);
    }
  };

  if (request === undefined) return null;

  return (
    <div className="mt-1.5 ml-3 pl-3 border-l space-y-1.5">
      {steps.map((s) => (
        <p key={s.id} className="text-xs text-muted-foreground">
          {s.decision === "approved" ? "Approuvé" : s.decision === "changes_requested" ? "Changements demandés" : "Commentaire"}
          {s.note ? ` — ${s.note}` : ""}
        </p>
      ))}
      {version.status === "in_review" && request && (
        <div className="flex flex-wrap items-end gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note de revue (facultatif)" className="min-w-[200px] flex-1 h-8 text-xs" />
          <Button size="sm" variant="outline" loading={deciding} onClick={() => handleDecide("approved")}><Check size={14} /> Approuver</Button>
          <Button size="sm" variant="outline" loading={deciding} onClick={() => handleDecide("changes_requested")}><X size={14} /> Demander des changements</Button>
          <Button size="sm" variant="ghost" loading={deciding} onClick={() => handleDecide("comment")}><MessageSquare size={14} /> Commenter</Button>
        </div>
      )}
    </div>
  );
}

/** CNT-011/012/013: an optional governed layer over session content
 *  delivery — only shows anything once at least one release exists (the
 *  common personal/solo path via publishContentVersion has none, and stays
 *  entirely unaffected). Only 'session' deployments sync a real consumer
 *  (course_sessions) on adopt — see the migration header for why 'path'/
 *  'public_url'/'integration' are createable but inert beyond bookkeeping. */
function DeploymentsPanel({ contentId }: { contentId: string }) {
  const [releases, setReleases] = useState<ContentRelease[]>([]);
  const [deployments, setDeployments] = useState<ContentDeployment[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<Record<string, ContentDeploymentUpdateCheck>>({});
  const [selectedRelease, setSelectedRelease] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [updatePolicy, setUpdatePolicy] = useState<ContentDeployment["update_policy"]>("pinned");
  const [creating, setCreating] = useState(false);

  const reload = () => {
    Promise.all([listContentReleases(contentId), listContentDeployments(contentId), listSessionsForContent(contentId)])
      .then(([r, d, s]) => { setReleases(r); setDeployments(d); setSessions(s); })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId]);

  if (loading) return null;
  if (releases.length === 0) return null;

  const sessionLabel = (id: string) => sessions.find((s) => s.id === id)?.label ?? id.slice(0, 8);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRelease || !selectedSession) return;
    setCreating(true);
    try {
      await createContentDeployment(selectedRelease, "session", selectedSession, updatePolicy);
      setSelectedSession("");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleCheck = async (deploymentId: string) => {
    try {
      const result = await checkContentDeploymentUpdate(deploymentId);
      setChecks((prev) => ({ ...prev, [deploymentId]: result }));
    } catch (err) {
      showError(err);
    }
  };

  const handleAdopt = async (deploymentId: string, toVersion: number) => {
    try {
      await adoptContentDeploymentUpdate(deploymentId, toVersion);
      setChecks((prev) => { const next = { ...prev }; delete next[deploymentId]; return next; });
      reload();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">Déploiements — sessions liées à une release</h4>
      {sessions.length > 0 && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-2">
          <select className="h-9 rounded-md border bg-transparent px-2 text-sm" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }} value={selectedRelease} onChange={(e) => setSelectedRelease(e.target.value)} aria-label="Release">
            <option value="">Release…</option>
            {releases.map((r) => <option key={r.id} value={r.id}>v{r.version} · {r.channel}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-transparent px-2 text-sm" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }} value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} aria-label="Session">
            <option value="">Session…</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-transparent px-2 text-sm" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }} value={updatePolicy} onChange={(e) => setUpdatePolicy(e.target.value as ContentDeployment["update_policy"])} aria-label="Politique de mise à jour">
            <option value="pinned">Figée (pinned)</option>
            <option value="follow_approved_updates">Suit les mises à jour approuvées</option>
          </select>
          <Button type="submit" size="sm" variant="outline" loading={creating}>Déployer</Button>
        </form>
      )}
      {deployments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun déploiement.</p>
      ) : (
        <ul className="space-y-1.5">
          {deployments.map((d) => {
            const check = checks[d.id];
            return (
              <li key={d.id} className="text-sm rounded border px-3 py-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span>Session « {sessionLabel(d.deployment_ref)} » · {d.update_policy === "pinned" ? "figée" : "suit les mises à jour"} · v{d.pinned_version}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleCheck(d.id)}>Vérifier les mises à jour</Button>
                </div>
                {check && (
                  check.has_update ? (
                    <div className="mt-1.5 flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5">
                      <span className="text-xs">Mise à jour disponible : v{check.latest_published_version}{check.changelog ? ` — ${check.changelog}` : ""}</span>
                      <Button size="sm" onClick={() => handleAdopt(d.id, check.latest_published_version!)}>Adopter</Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">À jour (v{check.pinned_version}).</p>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** CNT-003: structural diff between two versions of the same content,
 *  entirely client-side — content_versions.snapshot already carries the
 *  full state, nothing new to fetch. Generic across every content type
 *  (see contentDiff.ts's header for why a per-type view isn't built). */
function VersionDiffPanel({ versions }: { versions: ContentVersion[] }) {
  const sorted = [...versions].sort((a, b) => a.version - b.version);
  const [fromVersion, setFromVersion] = useState(sorted[sorted.length - 2]?.version ?? sorted[0].version);
  const [toVersion, setToVersion] = useState(sorted[sorted.length - 1].version);

  const from = versions.find((v) => v.version === fromVersion);
  const to = versions.find((v) => v.version === toVersion);
  const changes = from && to ? diffContentSnapshots(from.snapshot, to.snapshot) : [];

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">Comparer deux versions (CNT-003)</h4>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select className="h-8 rounded-md border bg-transparent px-2 text-xs" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }} value={fromVersion} onChange={(e) => setFromVersion(Number(e.target.value))} aria-label="Depuis la version">
          {sorted.map((v) => <option key={v.id} value={v.version}>v{v.version}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">→</span>
        <select className="h-8 rounded-md border bg-transparent px-2 text-xs" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }} value={toVersion} onChange={(e) => setToVersion(Number(e.target.value))} aria-label="Vers la version">
          {sorted.map((v) => <option key={v.id} value={v.version}>v{v.version}</option>)}
        </select>
      </div>
      {fromVersion === toVersion ? (
        <p className="text-xs text-muted-foreground">Choisissez deux versions différentes.</p>
      ) : changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune différence de contenu entre ces deux versions.</p>
      ) : (
        <ul className="space-y-0.5 rounded border p-2 font-mono text-xs max-h-64 overflow-y-auto">
          {changes.map((c, i) => <li key={i}>{describeDiffChange(c)}</li>)}
        </ul>
      )}
    </div>
  );
}

/** PUB-004 — token never re-fetchable once created is the security posture
 *  (preview_links has no anon-readable policy at all, see the migration
 *  header), but the OWNER can always see it again via this same panel:
 *  RLS's owner/pedago-admin select policy on preview_links is exactly what
 *  this list uses, so "copy the link again" always works for staff. */
function PreviewLinksPanel({ contentId }: { contentId: string }) {
  const [links, setLinks] = useState<PreviewLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiresHours, setExpiresHours] = useState(168);
  const [password, setPassword] = useState("");
  const [watermark, setWatermark] = useState(true);
  const [creating, setCreating] = useState(false);

  const reload = () => listPreviewLinks(contentId).then(setLinks).catch(showError).finally(() => setLoading(false));
  useEffect(() => { reload(); }, [contentId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const link = await createPreviewLink(contentId, { expiresInHours: expiresHours, password: password.trim() || undefined, watermark });
      setPassword("");
      await navigator.clipboard.writeText(buildPreviewLinkUrl(link.token)).catch(() => {});
      toast.success("Lien créé et copié dans le presse-papiers.");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokePreviewLink(id);
      reload();
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return null;

  const isActive = (l: PreviewLink) => !l.revoked_at && new Date(l.expires_at) > new Date();

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">Liens de prévisualisation (PUB-004)</h4>
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-2">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor={`expires-${contentId}`}>Expire dans (heures)</label>
          <Input id={`expires-${contentId}`} type="number" min={1} max={2160} value={expiresHours} onChange={(e) => setExpiresHours(Number(e.target.value))} className="h-8 w-24 text-xs" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor={`pwd-${contentId}`}>Mot de passe (facultatif)</label>
          <Input id={`pwd-${contentId}`} value={password} onChange={(e) => setPassword(e.target.value)} className="h-8 text-xs" />
        </div>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} /> Filigrane
        </label>
        <Button type="submit" size="sm" variant="outline" loading={creating}><Link2Icon size={14} /> Créer un lien</Button>
      </form>
      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun lien.</p>
      ) : (
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.id} className="text-xs rounded border px-2 py-1 flex items-center justify-between gap-2">
              <span>
                {isActive(l) ? <span style={{ color: "var(--ap-pres)" }}>actif</span> : <span className="text-muted-foreground">{l.revoked_at ? "révoqué" : "expiré"}</span>}
                {" · "}{l.view_count} vue(s){l.password_hash ? " · protégé" : ""}{l.watermark ? " · filigrane" : ""}
              </span>
              <div className="flex items-center gap-1">
                {isActive(l) && (
                  <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(buildPreviewLinkUrl(l.token)).then(() => toast.success("Copié."))}>Copier</Button>
                )}
                {isActive(l) && <Button variant="ghost" size="sm" onClick={() => handleRevoke(l.id)}>Révoquer</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** PUB-002 — content.data for a 'course' item mirrors the localStorage
 *  Course{title,modules,…} shape (contentRepo.ts's duplicateContent()
 *  header explains why: CourseBuilder edits localStorage directly, this
 *  table row is a synced mirror), so version.snapshot casts to Course. Only
 *  text/document/video/iframe lessons export faithfully — the report names
 *  every excluded lesson, never a silent drop (see scormExport.ts). */
function CourseExportPanel({ version }: { version: ContentVersion }) {
  const [exportingScorm, setExportingScorm] = useState(false);
  const [exportingXapi, setExportingXapi] = useState(false);
  const [report, setReport] = useState<ExportReportEntry[] | null>(null);

  const course = version.snapshot as unknown as Course;

  const handleScorm = async () => {
    setExportingScorm(true);
    try {
      const result = await buildScorm12Package(course);
      downloadBlob(result.blob, result.filename);
      setReport(result.report);
    } catch (err) {
      showError(err);
    } finally {
      setExportingScorm(false);
    }
  };

  const handleXapi = async () => {
    setExportingXapi(true);
    try {
      const result = await buildXapiExport(course, `${window.location.origin}/courses/${course.id}`);
      downloadBlob(result.blob, result.filename);
      setReport(result.report);
    } catch (err) {
      showError(err);
    } finally {
      setExportingXapi(false);
    }
  };

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">Export (PUB-002)</h4>
      <div className="flex items-center gap-2 mb-2">
        <Button size="sm" variant="outline" loading={exportingScorm} onClick={handleScorm}><Package size={14} /> SCORM 1.2</Button>
        <Button size="sm" variant="outline" loading={exportingXapi} onClick={handleXapi}><Package size={14} /> xAPI (JSON)</Button>
      </div>
      {report && (
        <ul className="space-y-0.5 text-xs">
          {report.map((r, i) => (
            <li key={i} className={r.status === "excluded" ? "text-muted-foreground" : ""}>
              {r.status === "exported" ? "✓" : "✗"} {r.module_title} — {r.lesson_title}{r.reason ? ` (${r.reason})` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContentVersionPanel({ item }: { item: ContentRow }) {
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [changelog, setChangelog] = useState("");
  const [comment, setComment] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingReview, setSubmittingReview] = useState<number | null>(null);
  const [releasingVersion, setReleasingVersion] = useState<number | null>(null);
  const [releaseNotes, setReleaseNotes] = useState("");

  const reload = () => {
    Promise.all([listContentVersions(item.id), listContentComments(item.id)])
      .then(([v, c]) => { setVersions(v); setComments(c); })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const latestVersion = versions[0]?.version ?? 0;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publishContentVersion(item.id, latestVersion, item.data, changelog || undefined);
      setChangelog("");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await saveContentDraft(item.id, latestVersion, item.data, changelog || undefined);
      setChangelog("");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitForReview = async (version: number) => {
    setSubmittingReview(version);
    try {
      await submitContentForReview(item.id, version);
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setSubmittingReview(null);
    }
  };

  const handlePublishApproved = async (version: number) => {
    try {
      await publishApprovedVersion(item.id, version, "library", releaseNotes.trim() || undefined);
      setReleasingVersion(null);
      setReleaseNotes("");
      reload();
    } catch (err) {
      showError(err);
    }
  };

  const handleRestore = async (version: number) => {
    try {
      await restoreContentVersion(item.id, version);
      reload();
    } catch (err) {
      showError(err);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      const c = await addContentComment(item.id, comment.trim());
      setComments((prev) => [...prev, c]);
      setComment("");
    } catch (err) {
      showError(err);
    }
  };

  const handleResolveComment = async (c: ContentComment) => {
    try {
      await resolveContentComment(c.id, !c.resolved);
      setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, resolved: !x.resolved } : x)));
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <TableSkeleton rows={2} cols={2} />;

  return (
    <div className="mt-3 border-t pt-3 space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1 space-y-1">
          <label className="text-sm font-medium" htmlFor={`changelog-${item.id}`}>Note de version</label>
          <Input id={`changelog-${item.id}`} value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="Ce qui a changé…" />
        </div>
        <Button size="sm" variant="outline" loading={savingDraft} onClick={handleSaveDraft}>Enregistrer brouillon v{latestVersion + 1}</Button>
        <Button size="sm" loading={publishing} onClick={handlePublish}><Upload /> Publier directement v{latestVersion + 1}</Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">« Publier directement » saute la revue (contenu personnel, sans processus d'organisation). « Enregistrer brouillon » ouvre le pipeline brouillon → revue → approuvé → publié (CNT-006).</p>

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune version.</p>
      ) : (
        <ul className="space-y-1.5">
          {versions.map((v) => (
            <li key={v.id} className="text-sm rounded border px-3 py-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span>v{v.version} · {STATUS_LABEL[v.status]} {v.changelog ? `— ${v.changelog}` : ""}</span>
                <div className="flex items-center gap-1.5">
                  {v.status === "draft" && (
                    <Button variant="outline" size="sm" loading={submittingReview === v.version} onClick={() => handleSubmitForReview(v.version)}>
                      <Send size={14} /> Soumettre pour revue
                    </Button>
                  )}
                  {v.status === "approved" && releasingVersion !== v.version && (
                    <Button variant="outline" size="sm" onClick={() => setReleasingVersion(v.version)}><CheckCircle2 size={14} /> Publier</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleRestore(v.version)}>Restaurer</Button>
                </div>
              </div>
              {v.status === "approved" && releasingVersion === v.version && (
                <div className="mt-1.5 flex flex-wrap items-end gap-2">
                  <Input value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} placeholder="Note de release (facultatif)" className="min-w-[200px] flex-1 h-8 text-xs" />
                  <Button size="sm" onClick={() => handlePublishApproved(v.version)}>Confirmer la publication</Button>
                </div>
              )}
              {(v.status === "in_review" || v.status === "changes_requested" || v.status === "approved") && (
                <ReviewPanel version={v} onDecided={reload} />
              )}
            </li>
          ))}
        </ul>
      )}

      {versions.length >= 2 && <VersionDiffPanel versions={versions} />}

      {item.type === "course" && versions.length > 0 && <CourseExportPanel version={versions[0]} />}

      <DeploymentsPanel contentId={item.id} />

      <PreviewLinksPanel contentId={item.id} />

      <div>
        <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><MessageSquare size={14} /> Commentaires</h4>
        <form onSubmit={handleComment} className="flex items-end gap-2 mb-2">
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ajouter un commentaire…" className="flex-1" />
          <Button type="submit" size="sm"><Plus /></Button>
        </form>
        {comments.length > 0 && (
          <ul className="space-y-1">
            {comments.map((c) => (
              <li key={c.id} className="text-sm rounded border px-3 py-1.5 flex items-center justify-between gap-2">
                <span className={c.resolved ? "text-muted-foreground line-through" : ""}>{c.body}</span>
                <Button variant="ghost" size="sm" onClick={() => handleResolveComment(c)}>{c.resolved ? "Rouvrir" : "Résoudre"}</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function LmsContentGovernance() {
  const user = getCurrentUser();
  const [items, setItems] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  useSEO({ title: "Gouvernance de contenu", description: "Versions, revue et publication du contenu." });

  useEffect(() => {
    if (!user) return;
    listRecentContent(user.id, 20).then(setItems).catch(showError).finally(() => setLoading(false));
  }, [user?.id]);

  if (!user) return null;

  if (loading) {
    return (
      <AppLayout subtitle="Gouvernance de contenu">
        <PageSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Gouvernance de contenu">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Gouvernance et diffusion du contenu"
          description="Un identifiant durable, des versions immuables et une publication jamais silencieuse."
        />
        <section className="product-list-panel p-5">
          <div className="product-panel-heading -mx-5 -mt-5 mb-4">
            <div><h2>Vos contenus</h2><p>Publier crée une version immuable ; une publication concurrente sur une base obsolète est refusée.</p></div>
          </div>
          {items.length === 0 ? (
            <ExplorerEmptyState icon={<GitCommitVertical size={27} />} title="Aucun contenu" body="Créez un quiz, un cours ou un examen pour commencer à versionner sa publication." />
          ) : (
            <ul className="space-y-2" aria-label="Contenus">
              {items.map((item) => (
                <li key={item.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{String((item.data as { title?: string })?.title ?? item.type)} <span className="text-muted-foreground">({item.type})</span></span>
                    <Button variant="ghost" size="sm" onClick={() => setExpanded((cur) => (cur === item.id ? null : item.id))}>
                      {expanded === item.id ? "Fermer" : "Versions"}
                    </Button>
                  </div>
                  {expanded === item.id && <ContentVersionPanel item={item} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
