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
      className="product-panel product-attention"
    >
      <div className="product-attention__copy">
        <span className="product-attention__icon">
          <MaterialSymbol name="fact_check" size={20} />
        </span>
        <div>
          <strong style={{ fontFamily: "var(--ap-font-display)", fontSize: 16 }}>
            {pendingExamCount} copie{pendingExamCount > 1 ? "s" : ""} à examiner
          </strong>
          <p className="ap-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            Nouvelles soumissions d'examen non consultées.
          </p>
        </div>
      </div>
      <button type="button" className="ap-btn ap-btn--sm" onClick={() => navigate("/notifications?filter=exam")}>
        Examiner les copies
      </button>
    </section>
  );
}
