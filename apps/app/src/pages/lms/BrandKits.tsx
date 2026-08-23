import { useEffect, useState } from "react";
import { Palette, Plus, Star, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeletons";
import { useActiveOrgId } from "@/components/org/OrgSwitcher";
import { showError } from "@/lib/errorTaxonomy";
import { useSEO } from "@/hooks/useSEO";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";
import {
  createBrandKit,
  deleteBrandKit,
  listBrandKits,
  setDefaultBrandKit,
  updateBrandKit,
  type BrandKit,
  type BrandKitColor,
} from "@/lib/lms/brandKits";
import { getAssetVersionSignedUrl, listAssetVersions, listMediaAssets, type MediaAsset } from "@/lib/lms/mediaLibrary";

/** CNT-019. No consumer reads a brand kit to theme rendered content in this
 *  codebase (see brandKits.ts's header) — the "prévisualisation" here is
 *  the only place these fields render anywhere, a real swatch/font/logo
 *  preview, not a stub. */
function BrandKitPanel({ kit, orgId, assets, onChanged, onDeleted }: { kit: BrandKit; orgId: string; assets: MediaAsset[]; onChanged: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(kit.name);
  const [colors, setColors] = useState<BrandKitColor[]>(kit.colors);
  const [fontsText, setFontsText] = useState(kit.fonts.join(", "));
  const [logoAssetId, setLogoAssetId] = useState(kit.logo_asset_id ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#000000");

  useEffect(() => {
    if (!logoAssetId) { setLogoUrl(null); return; }
    listAssetVersions(logoAssetId)
      .then((versions) => (versions[0] ? getAssetVersionSignedUrl(versions[0].storage_path) : null))
      .then(setLogoUrl)
      .catch(() => setLogoUrl(null));
  }, [logoAssetId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBrandKit(kit.id, {
        name: name.trim() || kit.name,
        colors,
        fonts: fontsText.split(",").map((f) => f.trim()).filter(Boolean),
        logo_asset_id: logoAssetId || null,
      });
      onChanged();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddColor = () => {
    if (!newColorName.trim()) return;
    setColors((prev) => [...prev, { name: newColorName.trim(), hex: newColorHex }]);
    setNewColorName("");
  };

  const handleSetDefault = async () => {
    try {
      await setDefaultBrandKit(kit.id);
      onChanged();
    } catch (err) {
      showError(err);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteBrandKit(kit.id);
      onDeleted();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <li className="rounded-md border p-3 text-sm space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 font-medium" />
          {kit.is_default && <span className="text-xs flex items-center gap-1" style={{ color: "var(--ap-pres)" }}><Star size={12} fill="currentColor" /> Par défaut</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {!kit.is_default && <Button variant="ghost" size="sm" onClick={handleSetDefault}>Définir par défaut</Button>}
          <Button variant="ghost" size="sm" onClick={handleDelete}><Trash2 size={14} /> Supprimer</Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Couleurs</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {colors.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs">
              <span className="inline-block w-3 h-3 rounded-full border" style={{ background: c.hex }} />
              {c.name} ({c.hex})
              <button type="button" onClick={() => setColors((prev) => prev.filter((_, j) => j !== i))} aria-label={`Retirer ${c.name}`}>×</button>
            </span>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Input value={newColorName} onChange={(e) => setNewColorName(e.target.value)} placeholder="Nom (ex. primaire)" className="h-8 text-xs w-40" />
          <input type="color" value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)} className="h-8 w-10 rounded border" aria-label="Couleur" />
          <Button size="sm" variant="outline" onClick={handleAddColor}><Plus size={14} /> Ajouter</Button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor={`fonts-${kit.id}`}>Polices autorisées (séparées par des virgules)</label>
        <Input id={`fonts-${kit.id}`} value={fontsText} onChange={(e) => setFontsText(e.target.value)} className="h-8 text-xs" placeholder="Inter, Georgia" />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor={`logo-${kit.id}`}>Logo (bibliothèque média)</label>
        <select id={`logo-${kit.id}`} className="h-8 w-full rounded-md border bg-transparent px-2 text-xs" style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }} value={logoAssetId} onChange={(e) => setLogoAssetId(e.target.value)}>
          <option value="">Aucun</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.file_name}</option>)}
        </select>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Prévisualisation</p>
        <div className="rounded border p-3 flex items-center gap-3 flex-wrap">
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 w-auto rounded" />}
          <div className="flex gap-1">
            {colors.map((c, i) => <span key={i} className="inline-block w-6 h-6 rounded border" style={{ background: c.hex }} title={c.name} />)}
          </div>
          <span className="text-sm" style={{ fontFamily: fontsText.split(",")[0]?.trim() || undefined }}>
            {fontsText.split(",")[0]?.trim() || "Police par défaut"}
          </span>
        </div>
      </div>

      <Button size="sm" loading={saving} onClick={handleSave}>Enregistrer</Button>
    </li>
  );
}

export default function BrandKitsPage() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId] = useActiveOrgId(memberships);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  useSEO({ title: "Brand kits", description: "Couleurs, polices, logo et règles d'accessibilité par organisation (CNT-019)." });

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([])).finally(() => setLoading(false));
  }, []);

  const reload = () => {
    if (!activeOrgId) return;
    listBrandKits(activeOrgId).then(setKits).catch(showError);
    listMediaAssets(activeOrgId).then(setAssets).catch(showError);
  };
  useEffect(reload, [activeOrgId]);

  const canManage = memberships.some((m) => m.org_id === activeOrgId && ["pedago", "admin"].includes(m.role));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !activeOrgId) return;
    setCreating(true);
    try {
      await createBrandKit(activeOrgId, newName.trim());
      setNewName("");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <AppLayout subtitle="Brand kits">
        <PageSkeleton />
      </AppLayout>
    );
  }

  if (!canManage || !activeOrgId) {
    return (
      <AppLayout subtitle="Brand kits">
        <div className="product-page product-page--compact">
          <div className="product-empty-inline">
            <ExplorerEmptyState icon={<Palette size={27} />} title="Accès réservé" body="Pédagogique ou administrateur d'organisation requis." />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Brand kits">
      <div className="product-page product-page--medium">
        <PageHeader title="Brand kits" description="Couleurs, polices, logo et règles d'accessibilité — un seul kit par défaut par organisation." />
        <section className="product-list-panel p-5">
          <div className="product-panel-heading -mx-5 -mt-5 mb-4">
            <div><h2>Nouveau kit</h2></div>
          </div>
          <form onSubmit={handleCreate} className="flex items-end gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom du kit" className="flex-1" />
            <Button type="submit" size="sm" loading={creating}><Plus size={14} /> Créer</Button>
          </form>
        </section>

        <section className="product-list-panel p-5 mt-4">
          <div className="product-panel-heading -mx-5 -mt-5 mb-4">
            <div><h2>Kits ({kits.length})</h2></div>
          </div>
          {kits.length === 0 ? (
            <ExplorerEmptyState icon={<Palette size={27} />} title="Aucun brand kit" body="Créez-en un pour commencer." />
          ) : (
            <ul className="space-y-3" aria-label="Brand kits">
              {kits.map((k) => <BrandKitPanel key={k.id} kit={k} orgId={activeOrgId} assets={assets} onChanged={reload} onDeleted={reload} />)}
            </ul>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
