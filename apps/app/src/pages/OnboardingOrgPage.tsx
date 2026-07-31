import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublicAccessShell } from "@/components/PublicAccessShell";
import styles from "@/components/PublicAccessShell.module.css";
import { showError } from "@/lib/errorTaxonomy";
import { createOrganization, slugify } from "@/lib/org/orgRepo";

export default function OnboardingOrgPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setBusy(true);
    setError("");
    try {
      await createOrganization(name.trim(), slug.trim());
      navigate("/dashboard", { replace: true });
    } catch (caughtError) {
      if (caughtError instanceof Error && caughtError.message.includes("slug_taken")) {
        setError("Cet identifiant est déjà utilisé. Choisissez-en un autre.");
      } else {
        showError(caughtError);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicAccessShell
      title="Créez votre établissement"
      description="Structurez vos contenus, vos équipes et vos participants dans un espace dédié."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="org-name">Nom de l’établissement</label>
          <input
            id="org-name"
            className={styles.input}
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="Lycée Victor Hugo"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="org-slug">Identifiant de l’espace</label>
          <input
            id="org-slug"
            className={styles.input}
            value={slug}
            onChange={(event) => {
              setSlug(slugify(event.target.value));
              setSlugTouched(true);
            }}
            aria-describedby="org-slug-help"
            required
          />
          <span id="org-slug-help" className={styles.helper}>
            Utilisé dans les liens et les invitations de votre équipe.
          </span>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={styles.primaryButton} type="submit" disabled={busy}>
          {busy ? "Création..." : "Créer l’établissement"}
        </button>
      </form>
    </PublicAccessShell>
  );
}
