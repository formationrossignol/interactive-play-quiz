import type { AppNotification, NotificationCategory } from "@/lib/notifications/types";
import { MaterialSymbol } from "@/components/MaterialSymbol";

const CATEGORY_META: Record<NotificationCategory, { label: string; icon: string; color: string; soft: string }> = {
  share: { label: "Partage", icon: "share", color: "var(--ap-brand)", soft: "var(--ap-brand-soft)" },
  exam: { label: "Examen", icon: "fact_check", color: "var(--content-exam-accent)", soft: "var(--content-exam-surface)" },
  support: { label: "Support", icon: "support_agent", color: "var(--ap-brand)", soft: "var(--ap-brand-soft)" },
  product: { label: "Produit", icon: "campaign", color: "var(--ap-brand)", soft: "var(--ap-brand-soft)" },
  system: { label: "Système", icon: "notifications", color: "var(--ap-muted)", soft: "var(--ap-paper-2)" },
};

const relativeTime = (iso: string) => {
  const deltaSeconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  if (Math.abs(deltaSeconds) < 60) return formatter.format(deltaSeconds, "second");
  const minutes = Math.round(deltaSeconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(days, "day");
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
};

export function NotificationItem({
  notification,
  onOpen,
  onToggleRead,
  onDelete,
  compact = false,
}: {
  notification: AppNotification;
  onOpen: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const meta = CATEGORY_META[notification.category];
  return (
    <article
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "auto minmax(0,1fr) auto",
        gap: 11,
        padding: compact ? "13px 15px" : "16px 18px",
        borderBottom: "var(--ap-border-w) solid var(--ap-line)",
        background: notification.readAt ? "transparent" : "color-mix(in srgb, var(--ap-brand-soft) 42%, var(--ap-card))",
      }}
    >
      {!notification.readAt && (
        <span
          aria-label="Non lue"
          style={{ position: "absolute", left: 5, top: 20, width: 5, height: 5, borderRadius: "50%", background: "var(--ap-brand)" }}
        />
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ouvrir la notification : ${notification.body || notification.title}`}
        style={{ display: "contents", color: "inherit", cursor: "pointer" }}
      >
        <span style={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: "var(--ap-r-md)", background: meta.soft, color: meta.color }}>
          <MaterialSymbol name={meta.icon} size={18} />
        </span>
        <span style={{ minWidth: 0, textAlign: "left" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
            <strong style={{ fontSize: 13.5, lineHeight: 1.35 }}>{notification.title}</strong>
            <span className="ap-pill" style={{ flexShrink: 0, fontSize: 9, padding: "2px 6px" }}>{meta.label}</span>
          </span>
          {notification.body && <span className="ap-muted" style={{ display: "block", fontSize: 12.5, lineHeight: 1.4 }}>{notification.body}</span>}
          <time className="ap-muted" dateTime={notification.createdAt} style={{ display: "block", marginTop: 5, fontSize: 10.5 }}>{relativeTime(notification.createdAt)}</time>
        </span>
      </button>
      <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          type="button"
          className="ap-btn ap-btn--ghost ap-icon-btn"
          onClick={onToggleRead}
          title={notification.readAt ? "Marquer comme non lue" : "Marquer comme lue"}
          aria-label={notification.readAt ? "Marquer comme non lue" : "Marquer comme lue"}
          style={{ width: 30, height: 30, minHeight: 30, padding: 0 }}
        >
          <MaterialSymbol name="check_circle" size={16} style={{ opacity: notification.readAt ? .45 : 1 }} />
        </button>
        <button
          type="button"
          className="ap-btn ap-btn--ghost ap-icon-btn"
          onClick={onDelete}
          title="Supprimer"
          aria-label="Supprimer la notification"
          style={{ width: 30, height: 30, minHeight: 30, padding: 0, color: "var(--ap-danger)" }}
        >
          <MaterialSymbol name="delete" size={16} />
        </button>
      </span>
    </article>
  );
}
