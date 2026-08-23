import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Globe2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton, ListSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import { listRecentContent } from "@/lib/content/contentRepo";
import type { ContentRow } from "@/lib/content/types";
import { listContentVersions, type ContentVersion } from "@/lib/lms/contentGovernance";
import { applyTranslations, extractTranslationSegments } from "@/lib/lms/localization";
import {
  addLocalizedVersion,
  createGlossaryTerm,
  createLocalizationSet,
  deleteGlossaryTerm,
  getLocalizationSet,
  listGlossaries,
  listLocalizedVersions,
  listTranslationSegments,
  setLocalizedVersionStatus,
  setTranslation,
  syncTranslationSegments,
  type Glossary,
  type LocalizationSet,
  type LocalizedVersion,
  type TranslationSegmentRow,
} from "@/lib/lms/localizationApi";

const STATUS_LABEL: Record<LocalizedVersion["status"], string> = {
  not_started: "non commencé",
  translating: "traduction",
  validation: "validation",
  needs_resync: "à resynchroniser",
  published: "publié",
};

/** L10N-002/004: extraction is pure client-side (localization.ts) against
 *  the latest published content_versions.snapshot; syncTranslationSegments()
 *  reconciles server-side, never erasing existing translations — only the
 *  counts (inserted/staled/unchanged) come back, real numbers from the RPC. */
function LocalizedVersionPanel({ version, sourceSnapshot, onChanged }: { version: LocalizedVersion; sourceSnapshot: Record<string, unknown> | null; onChanged: () => void }) {
  const [segments, setSegments] = useState<TranslationSegmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const reload = () => listTranslationSegments(version.id).then(setSegments).catch(showError).finally(() => setLoading(false));
  useEffect(() => { reload(); }, [version.id]);

  const handleSync = async () => {
    if (!sourceSnapshot) return;
    setSyncing(true);
    try {
      const extracted = extractTranslationSegments(sourceSnapshot);
      const result = await syncTranslationSegments(version.id, extracted, version.source_version);
      toast.success(`Synchronisé : ${result.inserted} nouveau(x), ${result.staled} devenu(s) obsolète(s), ${result.unchanged} inchangé(s).`);
      reload();
      onChanged();
    } catch (err) {
      showError(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleTranslate = async (segmentId: string, value: string) => {
    setSegments((prev) => prev.map((s) => (s.id === segmentId ? { ...s, translated_text: value } : s)));
  };

  const handleSaveTranslation = async (segmentId: string, value: string) => {
    try {
      await setTranslation(segmentId, value);
    } catch (err) {
      showError(err);
    }
  };

  const handleStatusChange = async (status: LocalizedVersion["status"]) => {
    try {
      await setLocalizedVersionStatus(version.id, status);
      onChanged();
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return <ListSkeleton rows={2} withAvatar={false} />;

  const preview = sourceSnapshot ? applyTranslations(sourceSnapshot, segments.map((s) => ({ path: s.path, translated_text: s.translated_text }))) : null;

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-medium">{version.language}</span>
        <div className="flex items-center gap-1.5">
          <select
            className="h-8 rounded-md border bg-transparent px-2 text-xs"
            style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }}
            value={version.status}
            onChange={(e) => handleStatusChange(e.target.value as LocalizedVersion["status"])}
          >
            {(Object.keys(STATUS_LABEL) as LocalizedVersion["status"][]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <Button variant="outline" size="sm" loading={syncing} onClick={handleSync} disabled={!sourceSnapshot}>
            <RefreshCw size={14} /> Synchroniser
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)}>{showPreview ? "Masquer l'aperçu" : "Aperçu (L10N-005)"}</Button>
        </div>
      </div>

      {segments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun segment — synchronisez d'abord depuis la version source publiée.</p>
      ) : (
        <ul className="space-y-1.5">
          {segments.map((s) => (
            <li key={s.id} className="text-xs">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-muted-foreground font-mono">{s.path}</span>
                {s.status === "stale" && <span style={{ color: "var(--ap-warn, #b45309)" }}>obsolète — source modifiée</span>}
              </div>
              <p className="text-muted-foreground mb-1">{s.source_text}</p>
              <Input
                value={s.translated_text ?? ""}
                onChange={(e) => handleTranslate(s.id, e.target.value)}
                onBlur={(e) => handleSaveTranslation(s.id, e.target.value)}
                placeholder="Traduction…"
                className="h-8 text-xs"
              />
            </li>
          ))}
        </ul>
      )}

      {showPreview && preview && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Aperçu traduit</p>
          <pre className="rounded border p-2 text-xs overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto" style={{ borderColor: "var(--ap-line)" }}>
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function LocalizationSetPanel({ item, orgId }: { item: ContentRow; orgId: string }) {
  const [set, setSet] = useState<LocalizationSet | null | undefined>(undefined);
  const [versions, setVersions] = useState<LocalizedVersion[]>([]);
  const [sourceVersion, setSourceVersion] = useState<ContentVersion | null>(null);
  const [newLanguage, setNewLanguage] = useState("en");
  const [creatingSet, setCreatingSet] = useState(false);
  const [addingLanguage, setAddingLanguage] = useState(false);

  const reload = () => {
    getLocalizationSet(item.id).then(setSet).catch(showError);
    listContentVersions(item.id).then((vs) => setSourceVersion(vs.find((v) => v.status === "published") ?? null)).catch(showError);
  };
  useEffect(reload, [item.id]);

  useEffect(() => {
    if (set) listLocalizedVersions(set.id).then(setVersions).catch(showError);
  }, [set]);

  const handleCreateSet = async () => {
    setCreatingSet(true);
    try {
      const created = await createLocalizationSet(item.id, "fr");
      setSet(created);
    } catch (err) {
      showError(err);
    } finally {
      setCreatingSet(false);
    }
  };

  const handleAddLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!set || !newLanguage.trim() || !sourceVersion) return;
    setAddingLanguage(true);
    try {
      await addLocalizedVersion(set.id, newLanguage.trim(), sourceVersion.version);
      listLocalizedVersions(set.id).then(setVersions).catch(showError);
    } catch (err) {
      showError(err);
    } finally {
      setAddingLanguage(false);
    }
  };

  if (set === undefined) return null;

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      {!set ? (
        <div>
          <p className="text-sm text-muted-foreground mb-2">Aucune famille de langues pour ce contenu (L10N-001).</p>
          <Button size="sm" variant="outline" loading={creatingSet} onClick={handleCreateSet}>Créer une famille de langues</Button>
        </div>
      ) : (
        <>
          {!sourceVersion && <p className="text-xs" style={{ color: "var(--ap-warn, #b45309)" }}>Aucune version publiée — publiez d'abord une version dans la gouvernance de contenu avant de synchroniser.</p>}
          <form onSubmit={handleAddLanguage} className="flex items-end gap-2">
            <Input value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)} placeholder="Code langue (en, es, de…)" className="h-8 w-40 text-xs" />
            <Button type="submit" size="sm" variant="outline" loading={addingLanguage} disabled={!sourceVersion}><Plus size={14} /> Ajouter une langue</Button>
          </form>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune langue ajoutée.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <LocalizedVersionPanel key={v.id} version={v} sourceSnapshot={sourceVersion?.snapshot ?? null} onChanged={reload} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GlossaryPanel({ orgId }: { orgId: string }) {
  const [terms, setTerms] = useState<Glossary[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [translationsText, setTranslationsText] = useState('{"en": ""}');
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = () => { listGlossaries(orgId).then(setTerms).catch(showError).finally(() => setLoading(false)); };
  useEffect(reload, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;
    let translations: Record<string, string>;
    try {
      translations = JSON.parse(translationsText || "{}");
    } catch {
      showError(new Error("JSON invalide pour les traductions"));
      return;
    }
    setCreating(true);
    try {
      await createGlossaryTerm(orgId, term.trim(), translations, note.trim() || undefined);
      setTerm(""); setNote("");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGlossaryTerm(id);
      reload();
    } catch (err) {
      showError(err);
    }
  };

  if (loading) return null;

  return (
    <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2 className="flex items-center gap-1.5"><BookOpen size={18} /> Glossaire ({terms.length})</h2><p>Référence pour les traducteurs (L10N-005) — non appliqué automatiquement, respecté manuellement.</p></div>
      </div>
      <form onSubmit={handleCreate} className="grid gap-2 sm:grid-cols-2 mb-3">
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Terme source" />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note de contexte (facultatif)" />
        <Input value={translationsText} onChange={(e) => setTranslationsText(e.target.value)} placeholder='{"en": "..."}' className="sm:col-span-2 font-mono text-xs" />
        <Button type="submit" size="sm" variant="outline" loading={creating} className="sm:col-span-2 w-fit"><Plus size={14} /> Ajouter</Button>
      </form>
      {terms.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun terme.</p>
      ) : (
        <ul className="space-y-1">
          {terms.map((t) => (
            <li key={t.id} className="text-xs rounded border px-2 py-1 flex items-center justify-between gap-2">
              <span>{t.term} → {Object.entries(t.translations).map(([lang, tr]) => `${lang}: ${tr}`).join(", ")}{t.note ? ` (${t.note})` : ""}</span>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}><Trash2 size={14} /></Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function LocalizationPage() {
  const user = getCurrentUser();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [items, setItems] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeOrgId] = useActiveOrgId(memberships);
  useSEO({ title: "Localisation", description: "Familles de langues, segments de traduction et glossaires (L10N-001 à 005)." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    listRecentContent(user.id, 20).then(setItems).catch(showError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const canManage = memberships.some((m) => m.org_id === activeOrgId && ["trainer", "pedago", "admin"].includes(m.role));

  if (!user) return null;

  if (loading) {
    return (
      <AppLayout subtitle="Localisation">
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!canManage || !activeOrgId) {
    return (
      <AppLayout subtitle="Localisation">
        <div className="product-page product-page--compact">
          <div className="product-empty-inline">
            <ExplorerEmptyState icon={<Globe2 size={27} />} title="Accès réservé" body="Formateur, pédagogique ou administrateur d'organisation requis." />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Localisation">
      <div className="product-page product-page--medium">
        <PageHeader title="Localisation" description="Une famille de langues par contenu, segments extraits automatiquement, jamais effacés lors d'une resynchronisation." />
        <section className="product-list-panel p-5">
          <div className="product-panel-heading -mx-5 -mt-5 mb-4">
            <div><h2>Vos contenus</h2></div>
          </div>
          {items.length === 0 ? (
            <ExplorerEmptyState icon={<Globe2 size={27} />} title="Aucun contenu" body="Créez un contenu pour commencer à le localiser." />
          ) : (
            <ul className="space-y-2" aria-label="Contenus">
              {items.map((item) => (
                <li key={item.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{String((item.data as { title?: string })?.title ?? item.type)} <span className="text-muted-foreground">({item.type})</span></span>
                    <Button variant="ghost" size="sm" onClick={() => setExpanded((cur) => (cur === item.id ? null : item.id))}>
                      {expanded === item.id ? "Fermer" : "Localiser"}
                    </Button>
                  </div>
                  {expanded === item.id && <LocalizationSetPanel item={item} orgId={activeOrgId} />}
                </li>
              ))}
            </ul>
          )}
        </section>
        <GlossaryPanel orgId={activeOrgId} />
      </div>
    </AppLayout>
  );
}
