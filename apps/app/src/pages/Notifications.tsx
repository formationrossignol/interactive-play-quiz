import { useMemo, useState } from "react";
import { Bell, BellOff, CheckCheck, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { NotificationPreferencesPanel } from "@/components/notifications/NotificationPreferencesPanel";
import { getCurrentUser } from "@/lib/auth";
import { useNotifications } from "@/hooks/useNotifications";
import type { NotificationCategory } from "@/lib/notifications/types";

const FILTERS: { key: "all" | "unread" | NotificationCategory; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "unread", label: "Non lues" },
  { key: "share", label: "Partages" },
  { key: "exam", label: "Examens" },
  { key: "support", label: "Support" },
  { key: "product", label: "Produit" },
];

export default function Notifications() {
  const user = getCurrentUser();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const center = useNotifications(user?.id);
  const visible = useMemo(() => center.notifications.filter((notification) => {
    if (filter === "all") return true;
    if (filter === "unread") return !notification.readAt;
    return notification.category === filter;
  }), [center.notifications, filter]);
  const notifyError = () => toast.error("La notification n’a pas pu être mise à jour");

  if (!user) return null;

  return (
    <AppLayout subtitle="Notifications">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 25 }}>
          <div>
            <h1 className="ap-h2" style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 26, marginBottom: 4 }}><Bell size={23} /> Notifications</h1>
            <p className="ap-muted" style={{ fontSize: 14 }}>Suivez les partages, l’activité de vos examens et les réponses du support.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ap-btn ap-btn--ghost ap-btn--sm" disabled={center.unreadCount === 0} onClick={() => center.markAllRead.mutate(undefined, { onError: notifyError })}><CheckCheck size={15} /> Tout lire</button>
            <button className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => setSettingsOpen((value) => !value)}><SlidersHorizontal size={15} /> Préférences</button>
          </div>
        </div>

        {settingsOpen && (
          <section className="ap-card" style={{ padding: "5px 20px 18px", marginBottom: 18 }}>
            <h2 className="ap-h3" style={{ paddingTop: 16, fontSize: 16 }}>Préférences</h2>
            <NotificationPreferencesPanel
              value={center.preferences}
              disabled={center.preferencesLoading || center.savePreferences.isPending}
              onChange={(preferences) => center.savePreferences.mutate(preferences, { onError: notifyError })}
            />
          </section>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
          {FILTERS.map(({ key, label }) => (
            <button key={key} className={filter === key ? "ap-btn ap-btn--sm" : "ap-btn ap-btn--ghost ap-btn--sm"} onClick={() => setFilter(key)}>{label}</button>
          ))}
          <button
            className="ap-btn ap-btn--ghost ap-btn--sm"
            style={{ marginLeft: "auto", color: "var(--ap-quiz)" }}
            disabled={!center.notifications.some((notification) => notification.readAt)}
            onClick={() => center.clearRead.mutate(undefined, { onError: notifyError })}
          >
            <Trash2 size={14} /> Effacer les lues
          </button>
        </div>

        <section className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
          {center.isLoading ? (
            <div className="ap-muted" style={{ padding: 36, textAlign: "center" }}>Chargement…</div>
          ) : visible.length === 0 ? (
            <ExplorerEmptyState
              icon={<BellOff size={27} />}
              title={filter === "unread" ? "Tout est lu" : "Aucune notification"}
              body="Vos prochaines activités importantes apparaîtront ici."
            />
          ) : visible.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onOpen={() => {
                if (!notification.readAt) center.markRead.mutate({ id: notification.id }, { onError: notifyError });
                if (notification.actionUrl) window.location.href = notification.actionUrl;
              }}
              onToggleRead={() => center.markRead.mutate({ id: notification.id, read: !notification.readAt }, { onError: notifyError })}
              onDelete={() => center.remove.mutate(notification.id, { onError: notifyError })}
            />
          ))}
        </section>
      </div>
    </AppLayout>
  );
}
