import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Blocks, LayoutTemplate, Link2, Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import { listRecentContent } from "@/lib/content/contentRepo";
import type { ContentRow, ContentType } from "@/lib/content/types";
import { CONTENT_TYPES } from "@/lib/content/types";
import {
  createContentTemplate,
  deleteContentTemplate,
  instantiateContentTemplate,
  listContentTemplates,
  type ContentTemplate,
} from "@/lib/lms/contentTemplates";
import {
  addReusableBlockVersion,
  adoptBlockUpdate,
  checkBlockDeletable,
  checkBlockUpdate,
  createReusableBlock,
  deleteReusableBlock,
  listBlockUsages,
  listReusableBlockVersions,
  listReusableBlocks,
  recordBlockUsage,
  removeBlockUsage,
  type BlockUsage,
  type ReusableBlock,
  type ReusableBlockVersion,
} from "@/lib/lms/reusableBlocks";

function parseJsonOrNull(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text || "{}");
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** CNT-016. Templates seed a new content item — deleting one never breaks
 *  anything already instantiated (instantiation copies data once, no
 *  ongoing link), unlike reusable blocks below. */
function TemplatesSection({ orgId }: { orgId: string }) {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<ContentType>("quiz");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [dataText, setDataText] = useState('{\n  "title": "Nouveau"\n}');
  const [creating, setCreating] = useState(false);
  const [instantiating, setInstantiating] = useState<string | null>(null);

  const reload = () => listContentTemplates(orgId).then(setTemplates).catch(showError).finally(() => setLoading(false));
  useEffect(() => { reload(); }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = parseJsonOrNull(dataText);
    if (!name.trim() || !data) { if (!data) showError(new Error("JSON invalide")); return; }
    setCreating(true);
    try {
      await createContentTemplate(orgId, type, name.trim(), data, tags.split(",").map((t) => t.trim()).filter(Boolean));
      setName(""); setTags("");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleInstantiate = async (templateId: string, templateName: string) => {
    setInstantiating(templateId);
    try {
      const created = await instantiateContentTemplate(templateId, `${templateName} (copie)`);
      toast.success(`Contenu créé (${created.type}, id ${created.id.slice(0, 8)}…) — ouvrez-le depuis votre bibliothèque de contenu.`);
    } catch (err) {
      showError(err);
    } finally {
      setInstantiating(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteContentTemplate(id);
      reload();
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return null;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2 className="flex items-center gap-1.5"><LayoutTemplate size={18} /> Modèles ({templates.length})</h2><p>Un modèle démarre un nouveau contenu — l'instanciation copie une fois, sans lien permanent (CNT-016).</p></div>
      </div>
      <form onSubmit={handleCreate} className="grid gap-2 sm:grid-cols-2 mb-4">
        <select className="h-9 rounded-md border bg-transparent px-2 text-sm" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }} value={type} onChange={(e) => setType(e.target.value as ContentType)} aria-label="Type">
          {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du modèle" />
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (séparés par des virgules)" className="sm:col-span-2" />
        <textarea value={dataText} onChange={(e) => setDataText(e.target.value)} className="w-full rounded-md border p-2 text-xs font-mono sm:col-span-2" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)", minHeight: 80 }} aria-label="Données du modèle (JSON)" />
        <Button type="submit" size="sm" variant="outline" loading={creating} className="sm:col-span-2 w-fit"><Plus size={14} /> Créer le modèle</Button>
      </form>
      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun modèle.</p>
      ) : (
        <ul className="space-y-1.5">
          {templates.map((t) => (
            <li key={t.id} className="text-sm rounded border px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap">
              <span>{t.name} · {t.type} · v{t.version} · {t.status}{t.tags.length > 0 ? ` · ${t.tags.join(", ")}` : ""}</span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" loading={instantiating === t.id} onClick={() => handleInstantiate(t.id, t.name)}>Instancier</Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}><Trash2 size={14} /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** CNT-017/018. A linked usage's "adopt" only records the author's
 *  decision (adopted_version) — it never rewrites the consuming content's
 *  own JSON, see reusableBlocks.ts's header. */
function BlockRow({ block, myContent, onChanged }: { block: ReusableBlock; myContent: ContentRow[]; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [versions, setVersions] = useState<ReusableBlockVersion[]>([]);
  const [usages, setUsages] = useState<BlockUsage[]>([]);
  const [checks, setChecks] = useState<Record<string, { has_update: boolean; latest_version: number | null }>>({});
  const [loading, setLoading] = useState(true);
  const [newVersionContent, setNewVersionContent] = useState('{\n  "html": ""\n}');
  const [addingVersion, setAddingVersion] = useState(false);
  const [linkContentId, setLinkContentId] = useState("");
  const [usageRef, setUsageRef] = useState("");
  const [linking, setLinking] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = () => {
    Promise.all([listReusableBlockVersions(block.id), listBlockUsages(block.id)])
      .then(([v, u]) => { setVersions(v); setUsages(u); })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (expanded) reload(); }, [expanded]);

  const handleAddVersion = async () => {
    const content = parseJsonOrNull(newVersionContent);
    if (!content) { showError(new Error("JSON invalide")); return; }
    setAddingVersion(true);
    try {
      await addReusableBlockVersion(block.id, content);
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setAddingVersion(false);
    }
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkContentId || versions.length === 0) return;
    setLinking(true);
    try {
      await recordBlockUsage(versions[0].id, linkContentId, usageRef.trim() || undefined);
      setLinkContentId(""); setUsageRef("");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (usageId: string) => {
    try {
      await removeBlockUsage(usageId);
      reload();
    } catch (err) {
      showError(err);
    }
  };

  const handleCheckUpdate = async (usageId: string) => {
    try {
      const result = await checkBlockUpdate(usageId);
      setChecks((prev) => ({ ...prev, [usageId]: { has_update: result.has_update, latest_version: result.latest_version } }));
    } catch (err) {
      showError(err);
    }
  };

  const handleAdopt = async (usageId: string, toVersion: number) => {
    try {
      await adoptBlockUpdate(usageId, toVersion);
      setChecks((prev) => { const next = { ...prev }; delete next[usageId]; return next; });
      reload();
    } catch (err) {
      showError(err);
    }
  };

  const handleDeleteAttempt = async () => {
    try {
      const check = await checkBlockDeletable(block.id);
      if (!check.deletable) {
        setDeleteBlocked(check.blocking_usages.map((u) => u.usage_ref ?? u.content_id));
        return;
      }
      setDeleting(true);
      await deleteReusableBlock(block.id);
      onChanged();
    } catch (err) {
      showError(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-medium">{block.name} <span className="text-muted-foreground">· {block.type}</span></span>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>{expanded ? "Fermer" : "Gérer"}</Button>
          <Button variant="ghost" size="sm" loading={deleting} onClick={handleDeleteAttempt}><Trash2 size={14} /> Supprimer</Button>
        </div>
      </div>
      {deleteBlocked && <p className="text-xs mt-1" style={{ color: "var(--ap-danger, #b91c1c)" }}>Utilisé par : {deleteBlocked.join(", ")} — retirez ces usages avant de supprimer.</p>}
      {expanded && !loading && (
        <div className="mt-3 border-t pt-3 space-y-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Versions</h4>
            <ul className="space-y-1 mb-1.5">
              {versions.map((v) => <li key={v.id} className="text-xs rounded border px-2 py-1">v{v.version}</li>)}
            </ul>
            <textarea value={newVersionContent} onChange={(e) => setNewVersionContent(e.target.value)} className="w-full rounded-md border p-2 text-xs font-mono" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)", minHeight: 60 }} aria-label="Contenu de la nouvelle version (JSON)" />
            <Button size="sm" variant="outline" loading={addingVersion} onClick={handleAddVersion} className="mt-1"><Plus size={14} /> Nouvelle version</Button>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Usages liés (CNT-018)</h4>
            {usages.length === 0 ? <p className="text-xs text-muted-foreground">Aucun usage lié.</p> : (
              <ul className="space-y-1">
                {usages.map((u) => {
                  const check = checks[u.id];
                  return (
                    <li key={u.id} className="text-xs rounded border px-2 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <span>{u.usage_ref ?? u.content_id.slice(0, 8)} · adopté v{u.adopted_version}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleCheckUpdate(u.id)}>Vérifier</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleUnlink(u.id)}>Retirer</Button>
                        </div>
                      </div>
                      {check?.has_update && (
                        <div className="mt-1 flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1">
                          <span>Mise à jour disponible : v{check.latest_version}</span>
                          <Button size="sm" onClick={() => handleAdopt(u.id, check.latest_version!)}>Adopter</Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <form onSubmit={handleLink} className="flex flex-wrap items-end gap-2 mt-1.5">
              <select className="h-8 rounded-md border bg-transparent px-2 text-xs" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }} value={linkContentId} onChange={(e) => setLinkContentId(e.target.value)} aria-label="Lier à un contenu">
                <option value="">Lier à un contenu…</option>
                {myContent.map((c) => <option key={c.id} value={c.id}>{String((c.data as { title?: string })?.title ?? c.type)}</option>)}
              </select>
              <Input value={usageRef} onChange={(e) => setUsageRef(e.target.value)} placeholder="Où (facultatif)" className="h-8 text-xs flex-1 min-w-[160px]" />
              <Button type="submit" size="sm" variant="outline" loading={linking}><Link2 size={14} /> Lier</Button>
            </form>
          </div>
        </div>
      )}
    </li>
  );
}

function BlocksSection({ orgId, myContent }: { orgId: string; myContent: ContentRow[] }) {
  const [blocks, setBlocks] = useState<ReusableBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"lesson" | "slide">("lesson");
  const [name, setName] = useState("");
  const [contentText, setContentText] = useState('{\n  "html": ""\n}');
  const [creating, setCreating] = useState(false);

  const reload = () => listReusableBlocks(orgId).then(setBlocks).catch(showError).finally(() => setLoading(false));
  useEffect(() => { reload(); }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = parseJsonOrNull(contentText);
    if (!name.trim() || !content) { if (!content) showError(new Error("JSON invalide")); return; }
    setCreating(true);
    try {
      await createReusableBlock(orgId, type, name.trim(), content);
      setName("");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return null;

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2 className="flex items-center gap-1.5"><Blocks size={18} /> Blocs réutilisables ({blocks.length})</h2><p>Copie = duplication ponctuelle, sans suivi. Lien = suivi d'usage, mise à jour jamais silencieuse (CNT-017/018).</p></div>
      </div>
      <form onSubmit={handleCreate} className="grid gap-2 sm:grid-cols-2 mb-4">
        <select className="h-9 rounded-md border bg-transparent px-2 text-sm" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }} value={type} onChange={(e) => setType(e.target.value as "lesson" | "slide")} aria-label="Type de bloc">
          <option value="lesson">lesson</option>
          <option value="slide">slide</option>
        </select>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du bloc" />
        <textarea value={contentText} onChange={(e) => setContentText(e.target.value)} className="w-full rounded-md border p-2 text-xs font-mono sm:col-span-2" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)", minHeight: 80 }} aria-label="Contenu du bloc (JSON)" />
        <Button type="submit" size="sm" variant="outline" loading={creating} className="sm:col-span-2 w-fit"><Plus size={14} /> Créer le bloc</Button>
      </form>
      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun bloc.</p>
      ) : (
        <ul className="space-y-2">
          {blocks.map((b) => <BlockRow key={b.id} block={b} myContent={myContent} onChanged={reload} />)}
        </ul>
      )}
    </section>
  );
}

export default function ContentLibraryPage() {
  const user = getCurrentUser();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [myContent, setMyContent] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  useSEO({ title: "Modèles et blocs", description: "Bibliothèque de modèles et blocs réutilisables (CNT-016 à 018)." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    listRecentContent(user.id, 20).then(setMyContent).catch(showError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const canManage = memberships.some((m) => m.org_id === activeOrgId && ["trainer", "pedago", "admin"].includes(m.role));

  if (!user) return null;

  if (loading) {
    return (
      <AppLayout subtitle="Modèles et blocs">
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!canManage || !activeOrgId) {
    return (
      <AppLayout subtitle="Modèles et blocs">
        <div className="product-page product-page--compact">
          <div className="product-empty-inline">
            <ExplorerEmptyState icon={<LayoutTemplate size={27} />} title="Accès réservé" body="Formateur, pédagogique ou administrateur d'organisation requis." />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Modèles et blocs">
      <div className="product-page product-page--medium">
        <PageHeader title="Modèles et blocs réutilisables" description="Un modèle amorce un nouveau contenu ; un bloc s'insère dans un contenu existant, copié ou lié." />
        <TemplatesSection orgId={activeOrgId} />
        <BlocksSection orgId={activeOrgId} myContent={myContent} />
      </div>
    </AppLayout>
  );
}
