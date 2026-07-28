import { useEffect, useMemo, useState } from "react";
import { Plus, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  listContentShares,
  usernamesByIds,
  type ContentShare,
} from "@/lib/sharing/sharingRepo";
import { ShareContentModal } from "@/components/ShareContentModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CollaboratorsButtonProps {
  contentId: string | null;
  contentTitle: string;
  canManage: boolean;
}

const avatarStyle = (index: number): React.CSSProperties => ({
  width: 34,
  height: 34,
  marginLeft: index === 0 ? 0 : -8,
  borderRadius: "50%",
  border: "2px solid var(--ap-card)",
  background: index === 0 ? "var(--ap-brand-soft)" : "var(--ap-paper-2)",
  color: index === 0 ? "var(--ap-brand-deep)" : "var(--ap-ink)",
  display: "grid",
  placeItems: "center",
  fontFamily: "var(--ap-font-display)",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  flexShrink: 0,
});

const initialOf = (value: string) => value.trim().charAt(0) || "?";

/**
 * Compact builder-level collaboration affordance inspired by creation tools:
 * owner/collaborator avatars followed by a circular invite button.
 */
export function CollaboratorsButton({
  contentId,
  contentTitle,
  canManage,
}: CollaboratorsButtonProps) {
  const user = getCurrentUser();
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<ContentShare[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!contentId || !canManage) {
      setShares([]);
      return;
    }
    let cancelled = false;
    listContentShares(contentId)
      .then(async (rows) => {
        if (cancelled) return;
        setShares(rows);
        const ids = rows
          .map((row) => row.shared_with_user_id)
          .filter((id): id is string => Boolean(id));
        if (!ids.length) return;
        const matches = await usernamesByIds(ids);
        if (!cancelled) {
          setUsernames(Object.fromEntries(matches.map((match) => [match.id, match.username])));
        }
      })
      .catch(() => {
        if (!cancelled) setShares([]);
      });
    return () => { cancelled = true; };
  }, [contentId, canManage, open]);

  const visibleCollaborators = useMemo(
    () => shares
      .filter((share) => share.shared_with_user_id || share.pending_email)
      .slice(0, 2),
    [shares],
  );

  const disabledTitle = contentId
    ? "Seul le propriétaire peut inviter des collaborateurs"
    : "Enregistrez d'abord cette création pour inviter des collaborateurs";

  return (
    <>
      <div
        style={{ display: "flex", alignItems: "center", paddingLeft: 8 }}
        aria-label="Collaborateurs"
      >
        <span style={avatarStyle(0)} title={user?.username ?? "Vous"}>
          {initialOf(user?.username ?? "")}
        </span>
        {canManage && visibleCollaborators.map((share, index) => {
          const label = share.shared_with_user_id
            ? usernames[share.shared_with_user_id] ?? "Collaborateur"
            : share.pending_email ?? "Invitation";
          return (
            <span key={share.id} style={avatarStyle(index + 1)} title={label}>
              {initialOf(label)}
            </span>
          );
        })}
        {!canManage && (
          <span style={{ ...avatarStyle(1), background: "var(--ap-paper-2)" }} title="Création partagée">
            <Users style={{ width: 15, height: 15 }} />
          </span>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span style={{ display: "inline-flex", marginLeft: 6 }}>
                <button
                  type="button"
                  onClick={() => { if (contentId && canManage) setOpen(true); }}
                  disabled={!contentId || !canManage}
                  aria-label={contentId && canManage ? "Inviter des collaborateurs" : disabledTitle}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    border: "var(--ap-border-w) solid var(--ap-line)",
                    background: "var(--ap-card)",
                    color: "var(--ap-ink)",
                    display: "grid",
                    placeItems: "center",
                    cursor: contentId && canManage ? "pointer" : "not-allowed",
                    opacity: contentId && canManage ? 1 : 0.5,
                    flexShrink: 0,
                  }}
                >
                  <Plus style={{ width: 20, height: 20 }} />
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{contentId && canManage ? "Inviter des collaborateurs" : disabledTitle}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {open && (
        <ShareContentModal
          contentId={contentId}
          contentTitle={contentTitle}
          defaultPermission="editor"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
