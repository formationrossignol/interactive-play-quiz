import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublicAccessShell } from "@/components/PublicAccessShell";
import styles from "@/components/PublicAccessShell.module.css";
import { showError } from "@/lib/errorTaxonomy";
import { updateProfile } from "@/lib/auth";
import { acceptOrgInvitation, createOrganization, slugify } from "@/lib/org/orgRepo";

type Step = "choice" | "trainer" | "learner";

/** Accepts a raw invitation token or a full invite URL — most students will
 *  paste whatever their trainer sent them, not necessarily the bare token. */
const extractInviteToken = (raw: string): string => {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    return url.searchParams.get("invite") || trimmed;
  } catch {
    return trimmed;
  }
};

export default function OnboardingOrgPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("choice");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [orgBusy, setOrgBusy] = useState(false);
  const [orgError, setOrgError] = useState("");

  const [inviteInput, setInviteInput] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);

  const chooseProfile = (step: "trainer" | "learner") => {
    setStep(step);
    // Cosmetic only (roleLabel has no permission effect) — best-effort, never
    // blocks the flow if it fails.
    void updateProfile({ roleLabel: step === "trainer" ? "Formateur" : "Étudiant" });
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleCreateOrg = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setOrgBusy(true);
    setOrgError("");
    try {
      await createOrganization(name.trim(), slug.trim());
      navigate("/dashboard", { replace: true });
    } catch (caughtError) {
      if (caughtError instanceof Error && caughtError.message.includes("slug_taken")) {
        setOrgError("Cet identifiant est déjà utilisé. Choisissez-en un autre.");
      } else {
        showError(caughtError);
      }
    } finally {
      setOrgBusy(false);
    }
  };

  const handleJoinOrg = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = extractInviteToken(inviteInput);
    if (!token) return;
    setInviteBusy(true);
    try {
      await acceptOrgInvitation(token);
      navigate("/dashboard", { replace: true });
    } catch (caughtError) {
      showError(caughtError);
    } finally {
      setInviteBusy(false);
    }
  };

  if (step === "choice") {
    return (
      <PublicAccessShell
        title="Bienvenue sur Brivia"
        description="Dites-nous qui vous êtes pour configurer votre espace."
      >
        <div className={styles.choiceGrid}>
          <button type="button" className={styles.choiceCard} onClick={() => chooseProfile("trainer")}>
            <strong>Je suis formateur·rice</strong>
            <span>Je crée l’espace de mon établissement et j’y invite mon équipe.</span>
          </button>
          <button type="button" className={styles.choiceCard} onClick={() => chooseProfile("learner")}>
            <strong>Je suis étudiant·e</strong>
            <span>Je rejoins l’espace de mon établissement avec un code d’invitation.</span>
          </button>
        </div>
      </PublicAccessShell>
    );
  }

  if (step === "learner") {
    return (
      <PublicAccessShell
        title="Rejoindre votre établissement"
        description="Collez le lien ou le code d’invitation reçu de votre formateur."
      >
        <form className={styles.form} onSubmit={handleJoinOrg}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="invite-token">Lien ou code d’invitation</label>
            <input
              id="invite-token"
              className={styles.input}
              value={inviteInput}
              onChange={(event) => setInviteInput(event.target.value)}
              placeholder="https://... ou le code reçu par e-mail"
              required
            />
            <span className={styles.helper}>
              Pas encore de code ? Demandez à votre formateur de vous envoyer une invitation.
            </span>
          </div>
          <button className={styles.primaryButton} type="submit" disabled={inviteBusy}>
            {inviteBusy ? "Connexion..." : "Rejoindre"}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => setStep("choice")}>
            ← Retour
          </button>
        </form>
      </PublicAccessShell>
    );
  }

  return (
    <PublicAccessShell
      title="Créez votre établissement"
      description="Structurez vos contenus, vos équipes et vos participants dans un espace dédié."
    >
      <form className={styles.form} onSubmit={handleCreateOrg}>
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
        {orgError && <p className={styles.error} role="alert">{orgError}</p>}
        <button className={styles.primaryButton} type="submit" disabled={orgBusy}>
          {orgBusy ? "Création..." : "Créer l’établissement"}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={() => setStep("choice")}>
          ← Retour
        </button>
      </form>
    </PublicAccessShell>
  );
}
