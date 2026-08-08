import { useState } from "react";
import { Bell, BellOff, CheckCheck, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/ui/skeletons";
import { useNotifications } from "@/hooks/useNotifications";
import type { User } from "@/lib/auth";
import { NotificationItem } from "./NotificationItem";
import { NotificationPreferencesPanel } from "./NotificationPreferencesPanel";

export function NotificationCenter({ user }: { user: User }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"all" | "unread" | "settings">("all");
  const center = useNotifications(user.id, 40);
  const visible = view === "unread"
    ? center.notifications.filter((notification) => !notification.readAt)
    : center.notifications;

  const notifyError = () => toast.error("La notification n’a pas pu être mise à jour");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={`ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn product-notification-trigger${center.unreadCount > 0 ? " product-notification-trigger--unread" : ""}`}
          style={{ position: "relative", height: 38, width: 38, padding: 0 }}
          aria-label={center.unreadCount > 0 ? `${center.unreadCount} notification${center.unreadCount > 1 ? "s" : ""} non lue${center.unreadCount > 1 ? "s" : ""}` : "Notifications"}
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {center.unreadCount > 0 && (
            <span
              className="product-notification-badge"
              style={{
                position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 4px",
                display: "grid", placeItems: "center", borderRadius: 9, background: "var(--ap-danger)",
                color: "#fff", fontSize: 9.5, fontWeight: 900, border: "2px solid var(--ap-paper)",
              }}
            >
              {center.unreadCount > 99 ? "99+" : center.unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full p-0 sm:max-w-[440px]"
        style={{ display: "grid", gridTemplateRows: "auto auto minmax(0,1fr) auto", background: "var(--ap-card)", color: "var(--ap-ink)", borderColor: "var(--ap-line)" }}
      >
        <SheetHeader style={{ padding: "20px 20px 10px", textAlign: "left" }}>
          <SheetTitle style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "var(--ap-font-display)", color: "var(--ap-ink)" }}>
            <Bell size={19} /> Notifications
            {center.unreadCount > 0 && <span className="ap-pill" style={{ marginLeft: 2, fontSize: 10 }}>{center.unreadCount} non lue{center.unreadCount > 1 ? "s" : ""}</span>}
          </SheetTitle>
        </SheetHeader>

        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px 12px", borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
          {([
            ["all", "Toutes"],
            ["unread", "Non lues"],
            ["settings", "Préférences"],
          ] as const).map(([key, label]) => (
            <button key={key} className={view === key ? "ap-btn ap-btn--sm" : "ap-btn ap-btn--ghost ap-btn--sm"} onClick={() => setView(key)}>
              {key === "settings" && <Settings2 size={14} />}{label}
            </button>
          ))}
        </div>

        <div style={{ minHeight: 0, overflowY: "auto" }}>
          {view === "settings" ? (
            <div style={{ padding: "4px 20px 20px" }}>
              <NotificationPreferencesPanel
                value={center.preferences}
                disabled={center.preferencesLoading || center.savePreferences.isPending}
                onChange={(preferences) => center.savePreferences.mutate(preferences, { onError: notifyError })}
              />
            </div>
          ) : center.isLoading ? (
            <div style={{ padding: "12px 20px" }}><ListSkeleton rows={4} /></div>
          ) : visible.length === 0 ? (
            <div style={{ minHeight: 280, display: "grid", placeItems: "center", padding: 28, textAlign: "center" }}>
              <div>
                <BellOff size={30} style={{ margin: "0 auto 12px", color: "var(--ap-muted)" }} />
                <strong style={{ display: "block", marginBottom: 5 }}>{view === "unread" ? "Tout est lu" : "Aucune notification"}</strong>
                <p className="ap-muted" style={{ margin: 0, fontSize: 12.5 }}>Les partages, copies d’examen et mises à jour apparaîtront ici.</p>
              </div>
            </div>
          ) : (
            visible.map((notification) => (
              <NotificationItem
                key={notification.id}
                compact
                notification={notification}
                onOpen={() => {
                  if (!notification.readAt) center.markRead.mutate({ id: notification.id }, { onError: notifyError });
                  if (notification.actionUrl) {
                    setOpen(false);
                    navigate(notification.actionUrl);
                  }
                }}
                onToggleRead={() => center.markRead.mutate({ id: notification.id, read: !notification.readAt }, { onError: notifyError })}
                onDelete={() => center.remove.mutate(notification.id, { onError: notifyError })}
              />
            ))
          )}
        </div>

        {view !== "settings" && (
          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-paper-2)" }}>
            <button
              className="ap-btn ap-btn--ghost ap-btn--sm"
              disabled={center.unreadCount === 0}
              onClick={() => center.markAllRead.mutate(undefined, { onError: notifyError })}
            >
              <CheckCheck size={15} /> Tout marquer comme lu
            </button>
            <button className="ap-btn ap-btn--sm" style={{ marginLeft: "auto" }} onClick={() => { setOpen(false); navigate("/notifications"); }}>
              Voir tout
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
