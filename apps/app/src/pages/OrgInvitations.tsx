import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeletons/ListSkeleton";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import {
  createOrgInvitation,
  listOrgInvitations,
  myOrgMemberships,
  revokeOrgInvitation,
  sendOrgInvitationEmail,
  type OrgInvitation,
  type OrgMembership,
  type OrgRole,
} from "@/lib/org/orgRepo";

const roleOptions: { value: OrgRole; label: string }[] = [
  { value: "learner", label: "Apprenant" },
  { value: "trainer", label: "Formateur" },
  { value: "pedago", label: "Responsable pédagogique" },
  { value: "registrar", label: "Gestionnaire de scolarité" },
  { value: "admin", label: "Administrateur" },
];

export default function OrgInvitations() {
  const user = getCurrentUser();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("learner");
  const [sending, setSending] = useState(false);

  const managedOrgId = memberships.find((m) => m.role === "admin" || m.role === "pedago")?.org_id ?? null;

  useEffect(() => {
    myOrgMemberships()
      .then(setMemberships)
      .catch(showError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!managedOrgId) return;
    listOrgInvitations(managedOrgId).then(setInvitations).catch(showError);
  }, [managedOrgId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managedOrgId || !user || !email.trim()) return;
    setSending(true);
    try {
      const invitation = await createOrgInvitation(managedOrgId, email.trim(), role, user.id);
      const inviteUrl = `${window.location.origin}/invite/${invitation.token}`;
      await sendOrgInvitationEmail(invitation.id, inviteUrl);
      setInvitations((prev) => [invitation, ...prev]);
      setEmail("");
      toast.success("Invitation envoyée");
    } catch (err) {
      showError(err);
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    try {
      await revokeOrgInvitation(invitationId);
      setInvitations((prev) =>
        prev.map((i) => (i.id === invitationId ? { ...i, status: "revoked" } : i)),
      );
    } catch (err) {
      showError(err);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (!managedOrgId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p>Vous devez être administrateur ou responsable pédagogique pour gérer les invitations.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Invitations</h1>
      <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label htmlFor="invite-email" className="text-sm font-medium">Email</label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as OrgRole)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <Button type="submit" loading={sending}>Inviter</Button>
      </form>

      <ul className="space-y-2">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">{invitation.email}</p>
              <p className="text-sm text-muted-foreground">
                {roleOptions.find((r) => r.value === invitation.role)?.label} · {invitation.status}
              </p>
            </div>
            {invitation.status === "pending" && (
              <Button variant="ghost" size="sm" onClick={() => handleRevoke(invitation.id)}>
                Révoquer
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
