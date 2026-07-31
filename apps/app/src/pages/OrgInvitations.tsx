import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ListSkeleton } from "@/components/ui/skeletons/ListSkeleton";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import {
  createOrgInvitation,
  fetchOrgSettings,
  grantOrgRole,
  listOrgInvitations,
  listOrgMembers,
  myOrgMemberships,
  removeOrgMember,
  revokeOrgInvitation,
  revokeOrgRole,
  sendOrgInvitationEmail,
  updateGuestAccess,
  type OrgInvitation,
  type OrgMember,
  type OrgMembership,
  type OrgRole,
} from "@/lib/org/orgRepo";
import { roleOptions, roleLabel } from "@/lib/org/roleLabels";

/** Postgrest errors are plain {code,message,...} objects, not `instanceof Error`. */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return String(err);
}

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
      if (errorMessage(err).includes("last_admin")) {
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
      if (errorMessage(err).includes("last_admin")) {
        toast.error("Impossible de retirer le dernier administrateur de l'organisation.");
      } else {
        showError(err);
      }
    }
  };

  if (!isAdmin) return null;
  if (loading) return <ListSkeleton rows={3} />;

  return (
    <section className="product-list-panel p-5">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Membres</h2><p>Gérez les rôles et les accès de votre équipe.</p></div>
      </div>
      <ul className="space-y-2" aria-label="Membres de l’organisation">
        {members.map((member) => {
          const label = member.username ?? member.email;
          const grantable = roleOptions.filter((r) => !member.roles.includes(r.value));
          return (
            <li key={member.user_id} className="rounded-lg border p-3 space-y-2" style={{ borderColor: "var(--ap-line)" }}>
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
    </section>
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
  const [guestAccess, setGuestAccess] = useState(false);
  const [guestAccessSaving, setGuestAccessSaving] = useState(false);

  const managedOrgId = memberships.find((m) => m.role === "admin" || m.role === "pedago")?.org_id ?? null;
  const isOrgAdmin = memberships.some((m) => m.org_id === managedOrgId && m.role === "admin");
  const canManageGuestAccess = memberships.some(
    (m) => m.org_id === managedOrgId && (m.role === "admin" || m.role === "pedago"),
  );

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

  useEffect(() => {
    if (!managedOrgId) return;
    fetchOrgSettings(managedOrgId).then((s) => setGuestAccess(s.guest_access_enabled)).catch(showError);
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

  const handleGuestAccessChange = async (enabled: boolean) => {
    if (!managedOrgId) return;
    const previous = guestAccess;
    setGuestAccess(enabled);
    setGuestAccessSaving(true);
    try {
      await updateGuestAccess(managedOrgId, enabled);
      toast.success(enabled ? "Accès invité activé" : "Accès invité désactivé");
    } catch (err) {
      setGuestAccess(previous);
      showError(err);
    } finally {
      setGuestAccessSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout subtitle="Organisation">
        <div className="product-page product-page--medium"><ListSkeleton rows={4} /></div>
      </AppLayout>
    );
  }

  if (!managedOrgId) {
    return (
      <AppLayout subtitle="Organisation">
        <div className="product-page product-page--compact">
          <div className="product-empty-inline">
            <div><strong>Accès réservé</strong><span>Vous devez être administrateur ou responsable pédagogique pour gérer les invitations.</span></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout subtitle="Organisation">
    <div className="product-page product-page--medium">
      <PageHeader
        title="Organisation"
        description="Invitez votre équipe et attribuez à chacun les permissions adaptées."
        action={
          canManageGuestAccess ? (
            <label className="flex items-center gap-2 text-sm">
              <span>Accès invité (sans compte)</span>
              <Switch checked={guestAccess} disabled={guestAccessSaving} onCheckedChange={handleGuestAccessChange} />
            </label>
          ) : undefined
        }
      />

      <MemberRoster orgId={managedOrgId} isAdmin={isOrgAdmin} />

      <section className="product-list-panel p-5 mt-4">
      <div className="product-panel-heading -mx-5 -mt-5 mb-4">
        <div><h2>Invitations</h2><p>Ajoutez une personne avec un rôle défini dès son arrivée.</p></div>
      </div>
      <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3 mb-5">
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

      {invitations.length === 0 ? (
        <div className="product-empty-inline" style={{ minHeight: 130 }}>
          <div><strong>Aucune invitation en attente</strong><span>Les invitations envoyées apparaîtront ici.</span></div>
        </div>
      ) : <ul className="space-y-2" aria-label="Invitations envoyées">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">{invitation.email}</p>
              <p className="text-sm text-muted-foreground">
                {roleOptions.find((r) => r.value === invitation.role)?.label}, {invitation.status}
              </p>
            </div>
            {invitation.status === "pending" && (
              <Button variant="ghost" size="sm" onClick={() => handleRevoke(invitation.id)}>
                Révoquer
              </Button>
            )}
          </li>
        ))}
      </ul>}
      </section>
    </div>
    </AppLayout>
  );
}
