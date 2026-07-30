import { useNavigate } from "react-router-dom";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { useNotifications } from "@/hooks/useNotifications";

/**
 * Surfaces unread exam-submission notifications as an actionable prompt —
 * a real proxy for "work waiting on you" built from data already computed
 * for the notification bell (no new backend aggregation invented). Renders
 * nothing when there's nothing to act on: this module earns its place by
 * being conditional, not by always occupying a slot.
 */
export function NeedsAttentionModule({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { notifications, isLoading } = useNotifications(userId);

  if (isLoading) return null;

  const pendingExamCount = notifications.filter(
    (notification) => notification.category === "exam" && !notification.readAt,
  ).length;

  if (pendingExamCount === 0) return null;

  return (
    <section
      className="ap-card"
      style={{
        padding: "20px", marginBottom: "32px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="ap-tile__icon" style={{ background: "var(--ap-brand-soft)", boxShadow: "0 3px 0 var(--ap-line)", marginBottom: 0, width: 40, height: 40 }}>
          <MaterialSymbol name="fact_check" size={20} style={{ color: "var(--ap-brand)" }} />
        </div>
        <div>
          <strong style={{ fontFamily: "var(--ap-font-display)", fontSize: 16 }}>
            {pendingExamCount} copie{pendingExamCount > 1 ? "s" : ""} à examiner
          </strong>
          <p className="ap-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            Nouvelles soumissions d'examen non consultées.
          </p>
        </div>
      </div>
      <button type="button" className="ap-btn ap-btn--sm" onClick={() => navigate("/notifications")}>
        Voir
      </button>
    </section>
  );
}
