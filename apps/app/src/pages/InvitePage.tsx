import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ListSkeleton } from "@/components/ui/skeletons/ListSkeleton";
import { PublicAccessShell } from "@/components/PublicAccessShell";
import styles from "@/components/PublicAccessShell.module.css";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import { marketingUrl } from "@/lib/marketingOrigin";
import { acceptOrgInvitation, getInvitationPreview, type InvitationPreview } from "@/lib/org/orgRepo";

const roleLabels: Record<string, string> = {
  learner: "apprenant",
  trainer: "formateur",
  pedago: "responsable pédagogique",
  registrar: "gestionnaire de scolarité",
  admin: "administrateur",
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) return;
    getInvitationPreview(token)
      .then(setPreview)
      .catch(showError)
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      await acceptOrgInvitation(token);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      showError(error);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <PublicAccessShell
        title="Vérification de l’invitation"
        description="Nous récupérons les informations de votre établissement."
      >
        <ListSkeleton rows={2} withAvatar={false} />
      </PublicAccessShell>
    );
  }

  if (!preview || preview.status !== "pending") {
    return (
      <PublicAccessShell
        title="Invitation indisponible"
        description="Ce lien a expiré, a déjà été utilisé ou n’est plus valide."
        centered
      >
        <a className={styles.secondaryButton} href={marketingUrl("/")}>Retour à l’accueil</a>
      </PublicAccessShell>
    );
  }

  const user = getCurrentUser();
  const role = roleLabels[preview.role] ?? preview.role;

  return (
    <PublicAccessShell
      title={`Rejoignez ${preview.org_name}`}
      description="Votre établissement vous invite à collaborer dans son espace Brivia."
    >
      <div className={styles.summary}>
        <strong>{preview.org_name}</strong>
        <span>Rôle proposé : {role}</span>
      </div>
      {user ? (
        <button className={styles.primaryButton} onClick={handleAccept} disabled={accepting}>
          {accepting ? "Acceptation..." : "Accepter l’invitation"}
        </button>
      ) : (
        <button className={styles.primaryButton} onClick={() => navigate(`/auth?invite=${token}`)}>
          Se connecter ou créer un compte
        </button>
      )}
    </PublicAccessShell>
  );
}
