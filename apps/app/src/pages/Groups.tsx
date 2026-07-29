import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, UserRoundPlus, UsersRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PersonPicker } from "@/components/sharing/PersonPicker";
import { ListSkeleton } from "@/components/ui/skeletons";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth";
import { showError } from "@/lib/errorTaxonomy";
import {
  addGroupMemberByUserId,
  createGroup,
  deleteGroup,
  listGroupMembers,
  listGroups,
  removeGroupMember,
  resolveGroupMemberByEmail,
  usernamesByIds,
  type Group,
  type GroupMember,
  type UsernameMatch,
} from "@/lib/sharing/sharingRepo";

export default function Groups() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [newGroupName, setNewGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedId) ?? null,
    [groups, selectedId],
  );

  const reloadGroups = async (preferredId?: string) => {
    if (!user) return;
    const rows = await listGroups(user.id);
    setGroups(rows);
    setSelectedId((current) => preferredId ?? current ?? rows[0]?.id ?? null);
  };

  const reloadMembers = async (groupId: string) => {
    setMembersLoading(true);
    try {
      const rows = await listGroupMembers(groupId);
      setMembers(rows);
      const ids = rows.map((member) => member.user_id).filter((id): id is string => Boolean(id));
      const matches = await usernamesByIds(ids);
      setUsernames(Object.fromEntries(matches.map((match) => [match.id, match.username])));
    } catch (error) {
      showError(error, "Groups.reloadMembers", "Impossible de charger les membres du groupe.");
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    reloadGroups()
      .catch((error) => showError(error, "Groups.reloadGroups", "Impossible de charger vos groupes."))
      .finally(() => setLoading(false));
  }, [navigate, user?.id]);

  useEffect(() => {
    if (selectedId) void reloadMembers(selectedId);
    else {
      setMembers([]);
      setUsernames({});
    }
  }, [selectedId]);

  const handleCreate = async () => {
    if (!user || !newGroupName.trim()) return;
    setBusy(true);
    try {
      const group = await createGroup(user.id, newGroupName.trim());
      setNewGroupName("");
      await reloadGroups(group.id);
      toast.success("Groupe créé");
    } catch (error) {
      showError(error, "Groups.create", "Impossible de créer ce groupe.");
    } finally {
      setBusy(false);
    }
  };

  const handleAddUser = async (match: UsernameMatch) => {
    if (!selectedId) return;
    try {
      await addGroupMemberByUserId(selectedId, match.id);
      await reloadMembers(selectedId);
      toast.success(`@${match.username} ajouté au groupe`);
    } catch (error) {
      showError(error, "Groups.addUser", "Impossible d’ajouter cette personne.");
    }
  };

  const handleInvite = async (email: string) => {
    if (!selectedId) return;
    try {
      await resolveGroupMemberByEmail(selectedId, email);
      await reloadMembers(selectedId);
      toast.success("Invitation ajoutée au groupe");
    } catch (error) {
      showError(error, "Groups.invite", "Impossible d’ajouter cette invitation.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedId) return;
    try {
      await removeGroupMember(memberId);
      await reloadMembers(selectedId);
      toast.success("Membre retiré");
    } catch (error) {
      showError(error, "Groups.removeMember", "Impossible de retirer ce membre.");
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup || !window.confirm(`Supprimer le groupe « ${selectedGroup.name} » ?`)) return;
    try {
      await deleteGroup(selectedGroup.id);
      setSelectedId(null);
      await reloadGroups();
      toast.success("Groupe supprimé");
    } catch (error) {
      showError(error, "Groups.delete", "Impossible de supprimer ce groupe.");
    }
  };

  if (!user) return null;

  return (
    <AppLayout subtitle="Groupes">
      <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8">
        <PageHeader
          onHome={() => navigate("/dashboard")}
          breadcrumbItems={[{ label: "Groupes" }]}
          eyebrow="Contacts réutilisables"
          title="Mes groupes"
          description="Une seule liste de membres pour vos partages de cours et vos demandes de signature."
        />

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="ap-card overflow-hidden p-0">
            <div className="flex gap-2 p-4" style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
              <input
                className="min-w-0 flex-1 rounded-md border bg-transparent px-3 text-sm"
                style={{ borderColor: "var(--ap-line)", color: "var(--ap-ink)" }}
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void handleCreate(); }}
                placeholder="Nom du groupe"
                maxLength={100}
              />
              <Button size="sm" loading={busy} disabled={!newGroupName.trim()} onClick={() => void handleCreate()}>
                <Plus />
                Créer
              </Button>
            </div>

            {loading ? (
              <div className="p-4"><ListSkeleton rows={4} withAvatar={false} /></div>
            ) : groups.length === 0 ? (
              <div className="p-8 text-center">
                <UsersRound className="mx-auto mb-3 h-8 w-8" style={{ color: "var(--ap-brand)" }} />
                <p className="font-bold">Aucun groupe</p>
                <p className="ap-muted mt-1 text-xs">Créez votre première liste de destinataires.</p>
              </div>
            ) : (
              <div className="p-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-bold transition-colors"
                    style={{
                      background: group.id === selectedId ? "var(--ap-brand-soft)" : "transparent",
                      color: "var(--ap-ink)",
                    }}
                    onClick={() => setSelectedId(group.id)}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: "var(--ap-card)", border: "1px solid var(--ap-line)" }}>
                      <UsersRound className="h-4 w-4" />
                    </span>
                    <span className="truncate">{group.name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="ap-card min-h-[420px] p-0">
            {!selectedGroup ? (
              <div className="grid min-h-[420px] place-items-center p-8 text-center">
                <div>
                  <UsersRound className="mx-auto mb-3 h-10 w-10" style={{ color: "var(--ap-muted)" }} />
                  <p className="font-bold">Sélectionnez un groupe</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 p-5" style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
                  <div>
                    <h2 className="ap-h2 text-xl">{selectedGroup.name}</h2>
                    <p className="ap-muted mt-1 text-xs">{members.length} membre{members.length !== 1 ? "s" : ""} ou invitation{members.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ color: "var(--ap-quiz)" }} onClick={() => void handleDeleteGroup()}>
                    <Trash2 className="h-4 w-4" />
                    Supprimer le groupe
                  </button>
                </div>

                <div className="p-5">
                  <div className="mb-5">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                      <UserRoundPlus className="h-4 w-4" />
                      Ajouter une personne
                    </div>
                    <PersonPicker onPickUsername={handleAddUser} onInviteEmail={handleInvite} />
                  </div>

                  {membersLoading ? (
                    <ListSkeleton rows={4} />
                  ) : members.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: "var(--ap-line)" }}>
                      <p className="font-bold">Ce groupe est vide</p>
                      <p className="ap-muted mt-1 text-xs">Ajoutez des comptes existants ou invitez-les par e-mail.</p>
                    </div>
                  ) : (
                    <div>
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 py-3"
                          style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold" style={{ background: "var(--ap-brand-soft)", color: "var(--ap-brand)" }}>
                            {(member.user_id ? usernames[member.user_id] : member.pending_email)?.charAt(0).toUpperCase() ?? "?"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">
                              {member.user_id ? `@${usernames[member.user_id] ?? "Membre"}` : member.pending_email}
                            </p>
                            {member.pending_email && <p className="ap-muted text-xs">Invitation en attente</p>}
                          </div>
                          <button
                            type="button"
                            className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn"
                            aria-label="Retirer du groupe"
                            onClick={() => void handleRemoveMember(member.id)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </AppLayout>
  );
}
