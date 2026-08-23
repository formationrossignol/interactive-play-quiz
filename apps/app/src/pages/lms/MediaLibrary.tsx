import { useEffect, useState } from "react";
import { Image, Link2, Plus, Trash2, Upload } from "lucide-react";
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
import {
  checkAssetDeletable,
  createMediaAsset,
  deleteMediaAsset,
  getAssetVersionSignedUrl,
  listAssetUsages,
  listAssetVersions,
  listMediaAssets,
  recordAssetUsage,
  removeAssetUsage,
  updateMediaAssetMeta,
  uploadAssetVersion,
  type AssetUsage,
  type MediaAsset,
  type MediaAssetVersion,
} from "@/lib/lms/mediaLibrary";

/** CNT-020 to CNT-023. Expanded per-asset: versions (with signed-URL
 *  download), usages (link/unlink to a content item, CNT-022's writer
 *  side), and guarded deletion (checkAssetDeletable before the button even
 *  attempts it, rather than surfacing a raw RPC error). */
function AssetRow({ asset, orgId, myContent, onChanged }: { asset: MediaAsset; orgId: string; myContent: ContentRow[]; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [versions, setVersions] = useState<MediaAssetVersion[]>([]);
  const [usages, setUsages] = useState<AssetUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [license, setLicense] = useState(asset.license ?? "");
  const [altText, setAltText] = useState(asset.alt_text ?? "");
  const [savingMeta, setSavingMeta] = useState(false);
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [linkContentId, setLinkContentId] = useState("");
  const [usageRef, setUsageRef] = useState("");
  const [linking, setLinking] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = () => {
    Promise.all([listAssetVersions(asset.id), listAssetUsages(asset.id)])
      .then(([v, u]) => { setVersions(v); setUsages(u); })
      .catch(showError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (expanded) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    try {
      await updateMediaAssetMeta(asset.id, { license: license.trim() || null, alt_text: altText.trim() || null });
    } catch (err) {
      showError(err);
    } finally {
      setSavingMeta(false);
    }
  };

  const handleUploadVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVersion(true);
    try {
      await uploadAssetVersion(orgId, asset.id, file);
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setUploadingVersion(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (storagePath: string) => {
    try {
      window.open(await getAssetVersionSignedUrl(storagePath), "_blank");
    } catch (err) {
      showError(err);
    }
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkContentId || versions.length === 0) return;
    setLinking(true);
    try {
      await recordAssetUsage(versions[0].id, linkContentId, usageRef.trim() || undefined);
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
      await removeAssetUsage(usageId);
      reload();
    } catch (err) {
      showError(err);
    }
  };

  const handleDeleteAttempt = async () => {
    try {
      const check = await checkAssetDeletable(asset.id);
      if (!check.deletable) {
        setDeleteBlocked(check.blocking_usages.map((u) => u.usage_ref ?? u.content_id));
        return;
      }
      setDeleting(true);
      await deleteMediaAsset(asset.id);
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
        <div>
          <span className="font-medium">{asset.file_name}</span>
          <span className="text-muted-foreground"> · {asset.mime_type ?? "?"} · {asset.language}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>{expanded ? "Fermer" : "Gérer"}</Button>
          <Button variant="ghost" size="sm" loading={deleting} onClick={handleDeleteAttempt}><Trash2 size={14} /> Supprimer</Button>
        </div>
      </div>
      {deleteBlocked && (
        <p className="text-xs mt-1" style={{ color: "var(--ap-danger, #b91c1c)" }}>
          Utilisé par : {deleteBlocked.join(", ")} — retirez ces usages avant de supprimer.
        </p>
      )}
      {expanded && (
        <div className="mt-3 border-t pt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor={`license-${asset.id}`}>Licence</label>
              <Input id={`license-${asset.id}`} value={license} onChange={(e) => setLicense(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs font-medium" htmlFor={`alt-${asset.id}`}>Texte alternatif</label>
              <Input id={`alt-${asset.id}`} value={altText} onChange={(e) => setAltText(e.target.value)} className="h-8 text-xs" />
            </div>
            <Button size="sm" variant="outline" loading={savingMeta} onClick={handleSaveMeta}>Enregistrer</Button>
          </div>

          {loading ? <ListSkeleton rows={2} withAvatar={false} /> : (
            <>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Versions</h4>
                <ul className="space-y-1">
                  {versions.map((v) => (
                    <li key={v.id} className="text-xs flex items-center justify-between rounded border px-2 py-1">
                      <span>v{v.version} · {v.hash.slice(0, 10)}…</span>
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(v.storage_path)}>Télécharger</Button>
                    </li>
                  ))}
                </ul>
                <label className="inline-flex mt-1.5" aria-label="Remplacer par une nouvelle version">
                  <Button size="sm" variant="outline" loading={uploadingVersion} asChild>
                    <span><Upload size={14} /> Remplacer (nouvelle version)</span>
                  </Button>
                  <input type="file" className="hidden" onChange={handleUploadVersion} />
                </label>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Usages</h4>
                {usages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun usage enregistré.</p>
                ) : (
                  <ul className="space-y-1">
                    {usages.map((u) => (
                      <li key={u.id} className="text-xs flex items-center justify-between rounded border px-2 py-1">
                        <span>{u.usage_ref ?? u.content_id.slice(0, 8)}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleUnlink(u.id)}>Retirer</Button>
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={handleLink} className="flex flex-wrap items-end gap-2 mt-1.5">
                  <select className="h-8 rounded-md border bg-transparent px-2 text-xs" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }} value={linkContentId} onChange={(e) => setLinkContentId(e.target.value)} aria-label="Contenu">
                    <option value="">Lier à un contenu…</option>
                    {myContent.map((c) => <option key={c.id} value={c.id}>{String((c.data as { title?: string })?.title ?? c.type)}</option>)}
                  </select>
                  <Input value={usageRef} onChange={(e) => setUsageRef(e.target.value)} placeholder="Où (facultatif) — ex. question 3" className="h-8 text-xs flex-1 min-w-[160px]" />
                  <Button type="submit" size="sm" variant="outline" loading={linking}><Link2 size={14} /> Lier</Button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function MediaLibraryPage() {
  const user = getCurrentUser();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [myContent, setMyContent] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  const [file, setFile] = useState<File | null>(null);
  const [license, setLicense] = useState("");
  const [altText, setAltText] = useState("");
  const [language, setLanguage] = useState("fr");
  const [uploading, setUploading] = useState(false);
  useSEO({ title: "Bibliothèque média", description: "Assets versionnés, usages et suppression gouvernée (CNT-020 à CNT-023)." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    listMediaAssets(activeOrgId).then(setAssets).catch(showError);
  }, [activeOrgId]);

  useEffect(() => {
    if (!user) return;
    listRecentContent(user.id, 20).then(setMyContent).catch(showError);
  }, [user?.id]);

  const canManage = memberships.some((m) => m.org_id === activeOrgId && ["trainer", "pedago", "admin"].includes(m.role));

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !activeOrgId) return;
    setUploading(true);
    try {
      await createMediaAsset(activeOrgId, file, { license: license.trim() || undefined, altText: altText.trim() || undefined, language });
      setFile(null); setLicense(""); setAltText("");
      listMediaAssets(activeOrgId).then(setAssets).catch(showError);
    } catch (err) {
      showError(err);
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <AppLayout subtitle="Bibliothèque média">
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!canManage || !activeOrgId) {
    return (
      <AppLayout subtitle="Bibliothèque média">
        <div className="product-page product-page--compact">
          <div className="product-empty-inline">
            <ExplorerEmptyState icon={<Image size={27} />} title="Accès réservé" body="Formateur, pédagogique ou administrateur d'organisation requis." />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Bibliothèque média">
      <div className="product-page product-page--medium">
        <PageHeader
          title="Bibliothèque média"
          description="Assets versionnés — remplacer crée une nouvelle version, une suppression bloquée par un usage réel n'écrase jamais rien silencieusement."
        />
        <section className="product-list-panel p-5">
          <div className="product-panel-heading -mx-5 -mt-5 mb-4">
            <div><h2>Ajouter un asset</h2></div>
          </div>
          <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-2">
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" aria-label="Fichier" />
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="new-license">Licence</label>
              <Input id="new-license" value={license} onChange={(e) => setLicense(e.target.value)} className="h-9 w-40" placeholder="CC-BY-4.0" />
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs font-medium" htmlFor="new-alt">Texte alternatif</label>
              <Input id="new-alt" value={altText} onChange={(e) => setAltText(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="new-lang">Langue</label>
              <Input id="new-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className="h-9 w-20" />
            </div>
            <Button type="submit" size="sm" loading={uploading} disabled={!file}><Plus size={14} /> Ajouter</Button>
          </form>
        </section>

        <section className="product-list-panel p-5 mt-4">
          <div className="product-panel-heading -mx-5 -mt-5 mb-4">
            <div><h2>Assets ({assets.length})</h2></div>
          </div>
          {assets.length === 0 ? (
            <ExplorerEmptyState icon={<Image size={27} />} title="Aucun asset" body="Ajoutez un fichier pour commencer." />
          ) : (
            <ul className="space-y-2" aria-label="Assets média">
              {assets.map((a) => (
                <AssetRow key={a.id} asset={a} orgId={activeOrgId} myContent={myContent} onChanged={() => listMediaAssets(activeOrgId).then(setAssets).catch(showError)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
