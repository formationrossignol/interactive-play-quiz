import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchSocialLinks,
  saveSocialLinks,
  SOCIAL_NETWORKS,
  type SocialLinks,
  type SocialNetworkId,
} from "@/lib/siteSettings";

/** Réglages du site — liens réseaux sociaux affichés dans le footer. */
export const SettingsTab = () => {
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
