import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeletons/ListSkeleton";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
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
    } catch (err) {
      showError(err);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ListSkeleton rows={2} withAvatar={false} />
      </div>
    );
  }

  if (!preview || preview.status !== "pending") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p>Cette invitation n'est plus valide.</p>
      </div>
    );
  }

  const user = getCurrentUser();

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
      <h1 className="text-2xl font-semibold">Invitation à rejoindre {preview.org_name}</h1>
      <p className="text-sm text-muted-foreground">
        En tant que {roleLabels[preview.role] ?? preview.role}
      </p>
      {user ? (
        <Button onClick={handleAccept} loading={accepting}>
          Accepter l'invitation
        </Button>
      ) : (
        <Button onClick={() => navigate(`/auth?invite=${token}`)}>
          Se connecter ou créer un compte
        </Button>
      )}
    </div>
  );
}
