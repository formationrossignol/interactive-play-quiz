import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import {
  fetchSocialLinks,
  saveSocialLinks,
  SOCIAL_NETWORKS,
  fetchPartners,
  savePartners,
  type SocialLinks,
  type SocialNetworkId,
  type Partner,
} from "@/lib/siteSettings";

/** Réglages du site — liens réseaux sociaux affichés dans le footer. */
const SocialLinksPanel = () => {
  const [links, setLinks] = useState<SocialLinks>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSocialLinks().then((l) => {
      if (!cancelled) { setLinks(l); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const setLink = (id: SocialNetworkId, value: string) =>
    setLinks((prev) => ({ ...prev, [id]: value }));

  const handleSave = async () => {
    // Une URL renseignée doit être http(s) — les champs vides sont ignorés.
    const invalid = SOCIAL_NETWORKS.filter(({ id }) => {
      const v = (links[id] ?? "").trim();
      return v !== "" && !/^https?:\/\//i.test(v);
    });
    if (invalid.length > 0) {
      toast.error("Lien invalide", {
        description: `${invalid.map((n) => n.label).join(", ")} : l'URL doit commencer par https://`,
      });
      return;
    }
    setSaving(true);
    const ok = await saveSocialLinks(links);
    setSaving(false);
    if (ok) toast.success("Réseaux sociaux enregistrés", { description: "Le footer est à jour." });
    else toast.error("Échec de l'enregistrement", { description: "Vérifiez vos droits admin et la migration site_settings." });
  };

  return (
    <section className="adm-panel">
      <div className="adm-panel-head">
        <h2>Réseaux sociaux</h2>
        <button className="adm-btn adm-btn--sm" onClick={handleSave} disabled={saving || loading}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      <p style={{ color: "var(--ap-muted)", fontWeight: 600, fontSize: 13.5, margin: "0 0 18px" }}>
        Les icônes apparaissent dans le footer du site, sur tous les thèmes.
        Laissez un champ vide pour masquer le réseau.
      </p>
      {loading ? (
        <div style={{ opacity: .5, fontWeight: 700 }}>Chargement…</div>
      ) : (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {SOCIAL_NETWORKS.map(({ id, label, placeholder }) => (
            <div key={id}>
              <label className="ap-label" htmlFor={`social-${id}`}>{label}</label>
              <input
                id={`social-${id}`}
                className="ap-input"
                type="url"
                inputMode="url"
                value={links[id] ?? ""}
                placeholder={placeholder}
                onChange={(e) => setLink(id, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const emptyPartner = (): Partner => ({ id: crypto.randomUUID(), name: "", logoUrl: "", link: "" });

/** Réglages du site — bandeau "Partenaires" (logos défilants) du footer. */
const PartnersPanel = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPartners().then((p) => {
      if (!cancelled) { setPartners(p.length > 0 ? p : []); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const updateRow = (id: string, patch: Partial<Partner>) =>
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addRow = () => setPartners((prev) => [...prev, emptyPartner()]);
  const removeRow = (id: string) => setPartners((prev) => prev.filter((p) => p.id !== id));

  const handleSave = async () => {
    const named = partners.filter((p) => p.name.trim() || p.logoUrl.trim());
    const invalid = named.filter((p) => !p.name.trim() || !/^https?:\/\//i.test(p.logoUrl.trim()));
    if (invalid.length > 0) {
      toast.error("Ligne invalide", {
        description: "Chaque partenaire a besoin d'un nom et d'une URL de logo commençant par https://",
      });
      return;
    }
    setSaving(true);
    const ok = await savePartners(named);
    setSaving(false);
    if (ok) {
      setPartners(named);
      toast.success("Partenaires enregistrés", { description: "Le bandeau du footer est à jour." });
    } else {
      toast.error("Échec de l'enregistrement", { description: "Vérifiez vos droits admin et la migration site_settings." });
    }
  };

  return (
    <section className="adm-panel" style={{ marginTop: 24 }}>
      <div className="adm-panel-head">
        <h2>Partenaires</h2>
        <button className="adm-btn adm-btn--sm" onClick={handleSave} disabled={saving || loading}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      <p style={{ color: "var(--ap-muted)", fontWeight: 600, fontSize: 13.5, margin: "0 0 18px" }}>
        Bandeau "Partenaires" à logos défilants, affiché dans le footer sur tous les thèmes.
        Laissez la liste vide pour masquer le bandeau.
      </p>
      {loading ? (
        <div style={{ opacity: .5, fontWeight: 700 }}>Chargement…</div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {partners.map((p) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1.6fr auto", gap: 10, alignItems: "end" }}>
                <div>
                  <label className="ap-label">Nom</label>
                  <input
                    className="ap-input"
                    value={p.name}
                    placeholder="Nom du partenaire"
                    onChange={(e) => updateRow(p.id, { name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="ap-label">Logo (URL)</label>
                  <input
                    className="ap-input"
                    type="url"
                    inputMode="url"
                    value={p.logoUrl}
                    placeholder="https://…/logo.svg"
                    onChange={(e) => updateRow(p.id, { logoUrl: e.target.value })}
                  />
                </div>
                <div>
                  <label className="ap-label">Lien (optionnel)</label>
                  <input
                    className="ap-input"
                    type="url"
                    inputMode="url"
                    value={p.link ?? ""}
                    placeholder="https://partenaire.com"
                    onChange={(e) => updateRow(p.id, { link: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="adm-btn adm-btn--ghost adm-btn--sm"
                  aria-label="Supprimer ce partenaire"
                  onClick={() => removeRow(p.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="adm-btn adm-btn--ghost adm-btn--sm"
            style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={addRow}
          >
            <Plus className="h-4 w-4" /> Ajouter un partenaire
          </button>
        </>
      )}
    </section>
  );
};

export const SettingsTab = () => (
  <>
    <SocialLinksPanel />
    <PartnersPanel />
  </>
);
