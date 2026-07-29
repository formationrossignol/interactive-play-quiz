import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeletons/ListSkeleton";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import {
  createOrgInvitation,
  grantOrgRole,
  listOrgInvitations,
  listOrgMembers,
  myOrgMemberships,
  removeOrgMember,
  revokeOrgInvitation,
  revokeOrgRole,
  sendOrgInvitationEmail,
  type OrgInvitation,
  type OrgMember,
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

const roleLabel = (role: OrgRole): string => roleOptions.find((r) => r.value === role)?.label ?? role;

function MemberRoster({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingRoleFor, setAddingRoleFor] = useState<string | null>(null);

  const reload = () => {
    listOrgMembers(orgId).then(setMembers).catch(showError).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isAdmin]);

  const handleGrant = async (userId: string, role: OrgRole) => {
    try {
      await grantOrgRole(orgId, userId, role);
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, roles: [...m.roles, role].sort() } : m)));
      setAddingRoleFor(null);
    } catch (err) {
      showError(err);
    }
  };

  const handleRevoke = async (userId: string, role: OrgRole) => {
    try {
      await revokeOrgRole(orgId, userId, role);
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, roles: m.roles.filter((r) => r !== role) } : m)));
    } catch (err) {
      if (err instanceof Error && err.message.includes("last_admin")) {
        toast.error("Impossible de retirer le dernier administrateur de l'organisation.");
      } else {
        showError(err);
      }
    }
  };

  const handleRemove = async (userId: string, label: string) => {
    if (!window.confirm(`Retirer ${label} de l'organisation ?`)) return;
    try {
      await removeOrgMember(orgId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      if (err instanceof Error && err.message.includes("last_admin")) {
        toast.error("Impossible de retirer le dernier administrateur de l'organisation.");
      } else {
        showError(err);
      }
    }
  };

  if (!isAdmin) return null;
  if (loading) return <ListSkeleton rows={3} />;

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Membres</h2>
      <ul className="space-y-2">
        {members.map((member) => {
          const label = member.username ?? member.email;
          const grantable = roleOptions.filter((r) => !member.roles.includes(r.value));
          return (
            <li key={member.user_id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(member.user_id, label)}>
                  Retirer
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {member.roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                  >
                    {roleLabel(role)}
                    <button
                      type="button"
                      aria-label={`Retirer le rôle ${roleLabel(role)}`}
                      onClick={() => handleRevoke(member.user_id, role)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {grantable.length > 0 && (
                  addingRoleFor === member.user_id ? (
                    <select
                      autoFocus
                      onChange={(e) => handleGrant(member.user_id, e.target.value as OrgRole)}
                      onBlur={() => setAddingRoleFor(null)}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                      defaultValue=""
                    >
                      <option value="" disabled>Ajouter un rôle…</option>
                      {grantable.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingRoleFor(member.user_id)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      + rôle
                    </button>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function OrgInvitations() {
  const user = getCurrentUser();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("learner");
  const [sending, setSending] = useState(false);

  const managedOrgId = memberships.find((m) => m.role === "admin" || m.role === "pedago")?.org_id ?? null;
  const isOrgAdmin = memberships.some((m) => m.org_id === managedOrgId && m.role === "admin");

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
      <h1 className="text-2xl font-semibold">Organisation</h1>

      <MemberRoster orgId={managedOrgId} isAdmin={isOrgAdmin} />

      <h2 className="text-lg font-semibold">Invitations</h2>
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
