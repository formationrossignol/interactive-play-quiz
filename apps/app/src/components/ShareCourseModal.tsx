import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { PersonPicker } from "@/components/sharing/PersonPicker";
import {
  addContentShareByGroupId,
  addContentShareByUserId,
  addGroupMemberByUserId,
  createGroup,
  listContentShares,
  listGroupMembers,
  listGroups,
  removeContentShare,
  removeGroupMember,
  resolveContentShareByEmail,
  resolveGroupMemberByEmail,
  usernamesByIds,
  type ContentShare,
  type Group,
  type GroupMember,
  type UsernameMatch,
} from "@/lib/sharing/sharingRepo";

interface ShareCourseModalProps {
  contentId: string | null;
  courseTitle: string;
  onClose: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};

const panelStyle: React.CSSProperties = {
  width: "min(520px, 92vw)", maxHeight: "80vh", overflowY: "auto",
  background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)",
  borderRadius: "var(--ap-r-lg)", boxShadow: "var(--ap-shadow-card)", padding: 20,
};

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: "var(--ap-r-pill)", border: "none", cursor: "pointer",
  fontSize: 13, fontWeight: 800, fontFamily: "var(--ap-font-body)",
  background: active ? "var(--ap-brand)" : "var(--ap-paper-2)",
  color: active ? "#fff" : "var(--ap-ink)",
});

const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
  borderBottom: "var(--ap-border-w) solid var(--ap-line)",
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Une erreur est survenue");

export const ShareCourseModal = ({ contentId, courseTitle, onClose }: ShareCourseModalProps) => {
  const user = getCurrentUser();
  const [tab, setTab] = useState<"people" | "groups">("people");
  const [shares, setShares] = useState<ContentShare[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const setBusyKey = (key: string, value: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (value) next.add(key); else next.delete(key);
      return next;
    });
  };

  /** Runs `fn`, disabling any control keyed by `key` while it's in flight, and
   *  toasting on failure instead of leaving the UI silently stuck. */
  const runBusy = (key: string, fn: () => Promise<unknown>) => {
    if (busy.has(key)) return;
    setBusyKey(key, true);
    fn()
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setBusyKey(key, false));
  };

  const reloadShares = (id: string) => {
    listContentShares(id)
      .then((rows) => {
        setShares(rows);
        const ids = rows.map((r) => r.shared_with_user_id).filter((v): v is string => !!v);
        if (ids.length) {
          usernamesByIds(ids)
            .then((matches) => setUsernames(Object.fromEntries(matches.map((m) => [m.id, m.username]))))
            .catch((e) => toast.error(errMsg(e)));
        }
      })
      .catch((e) => toast.error(errMsg(e)));
  };

  const reloadGroups = () => {
    if (!user) return;
    listGroups(user.id).then(setGroups).catch((e) => toast.error(errMsg(e)));
  };

  useEffect(() => {
    if (!contentId) return;
    reloadShares(contentId);
    reloadGroups();
  }, [contentId]);

  if (!contentId) return null;

  const sharedGroupIds = new Set(shares.map((s) => s.shared_with_group_id).filter(Boolean));

  const handlePickUsername = (match: UsernameMatch) => {
    runBusy(`add-user-${match.id}`, () =>
      addContentShareByUserId(contentId, match.id).then(() => reloadShares(contentId)));
  };
  const handleInviteEmail = (email: string) => {
    runBusy(`invite-${email}`, () =>
      resolveContentShareByEmail(contentId, email).then(() => reloadShares(contentId)));
  };
  const handleRemoveShare = (shareId: string) => {
    runBusy(`share-${shareId}`, () =>
      removeContentShare(shareId).then(() => reloadShares(contentId)));
  };

  const toggleGroupShare = (group: Group, shared: boolean) => {
    runBusy(`group-${group.id}`, () => {
      if (shared) {
        return addContentShareByGroupId(contentId, group.id).then(() => reloadShares(contentId));
      }
      const share = shares.find((s) => s.shared_with_group_id === group.id);
      return share ? removeContentShare(share.id).then(() => reloadShares(contentId)) : Promise.resolve();
    });
  };

  const handleCreateGroup = () => {
    if (!user || !newGroupName.trim()) return;
    runBusy("create-group", () =>
      createGroup(user.id, newGroupName.trim()).then((group) => {
        setNewGroupName("");
        reloadGroups();
        setExpandedGroupId(group.id);
      }));
  };

  const loadMembers = (groupId: string) => {
    listGroupMembers(groupId)
      .then((members) => setGroupMembers((prev) => ({ ...prev, [groupId]: members })))
      .catch((e) => toast.error(errMsg(e)));
  };

  const toggleExpandGroup = (groupId: string) => {
    const next = expandedGroupId === groupId ? null : groupId;
    setExpandedGroupId(next);
    if (next) loadMembers(next);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 className="ap-h3" style={{ fontSize: 16 }}>{t("shareManageAccess")}</h2>
            <p className="ap-muted" style={{ fontSize: 12 }}>{courseTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button type="button" style={tabBtnStyle(tab === "people")} onClick={() => setTab("people")}>{t("sharePeopleTab")}</button>
          <button type="button" style={tabBtnStyle(tab === "groups")} onClick={() => setTab("groups")}>{t("shareGroupsTab")}</button>
        </div>

        {tab === "people" ? (
          <div>
            <PersonPicker onPickUsername={handlePickUsername} onInviteEmail={handleInviteEmail} />
            <div style={{ marginTop: 16 }}>
              {shares.filter((s) => s.shared_with_user_id || s.pending_email).length === 0 ? (
                <p className="ap-muted" style={{ fontSize: 13 }}>{t("shareNoShares")}</p>
              ) : (
                shares
                  .filter((s) => s.shared_with_user_id || s.pending_email)
                  .map((share) => (
                    <div key={share.id} style={rowStyle}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
                        {share.shared_with_user_id
                          ? `@${usernames[share.shared_with_user_id] ?? "…"}`
                          : share.pending_email}
                      </span>
                      {share.pending_email && !share.shared_with_user_id && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ap-muted)" }}>{t("sharePending")}</span>
                      )}
                      <button
                        type="button"
                        className="ap-btn ap-btn--ghost ap-btn--sm"
                        disabled={busy.has(`share-${share.id}`)}
                        onClick={() => handleRemoveShare(share.id)}
                      >
                        {t("shareRemove")}
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup(); }}
                placeholder={t("shareGroupNamePlaceholder")}
                style={{
                  flex: 1, height: 34, padding: "0 10px", borderRadius: "var(--ap-r-md)",
                  border: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-paper-2)",
                  color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)", fontSize: 13,
                }}
              />
              <button type="button" className="ap-btn ap-btn--sm" disabled={busy.has("create-group")} onClick={handleCreateGroup}>
                {t("shareCreateGroup")}
              </button>
            </div>

            {groups.map((group) => (
              <div key={group.id} style={{ marginBottom: 8 }}>
                <div style={rowStyle}>
                  <input
                    type="checkbox"
                    checked={sharedGroupIds.has(group.id)}
                    disabled={busy.has(`group-${group.id}`)}
                    onChange={(e) => toggleGroupShare(group, e.target.checked)}
                  />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{group.name}</span>
                  <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => toggleExpandGroup(group.id)}>
                    {t("shareManageMembers")}
                  </button>
                </div>
                {expandedGroupId === group.id && (
                  <div style={{ paddingLeft: 24, paddingTop: 8 }}>
                    <PersonPicker
                      onPickUsername={(match) =>
                        runBusy(`member-add-${match.id}`, () =>
                          addGroupMemberByUserId(group.id, match.id).then(() => loadMembers(group.id)))}
                      onInviteEmail={(email) =>
                        runBusy(`member-invite-${email}`, () =>
                          resolveGroupMemberByEmail(group.id, email).then(() => loadMembers(group.id)))}
                    />
                    <div style={{ marginTop: 8 }}>
                      {(groupMembers[group.id] ?? []).map((member) => (
                        <div key={member.id} style={rowStyle}>
                          <span style={{ flex: 1, fontSize: 13 }}>
                            {member.pending_email ?? member.user_id}
                          </span>
                          <button
                            type="button"
                            className="ap-btn ap-btn--ghost ap-btn--sm"
                            disabled={busy.has(`member-${member.id}`)}
                            onClick={() =>
                              runBusy(`member-${member.id}`, () =>
                                removeGroupMember(member.id).then(() => loadMembers(group.id)))}
                          >
                            {t("shareRemove")}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
