import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";

interface PlanLimitBlockerProps {
  title: string;
  description: string;
}

export const PlanLimitBlocker = ({ title, description }: PlanLimitBlockerProps) => {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div className="ap-card ap-card--floaty" style={{ maxWidth: 440, width: "100%", textAlign: "center", padding: "40px" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--ap-brand-soft)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
          <Lock style={{ width: 32, height: 32, color: "var(--ap-brand)" }} strokeWidth={2} />
        </div>
        <h2 className="ap-h2" style={{ fontSize: "24px", marginBottom: "12px" }}>{title}</h2>
        <p className="ap-muted" style={{ fontSize: "15px", marginBottom: "24px" }}>{description}</p>
        <button className="ap-btn ap-btn--pill" onClick={() => navigate("/pricing")}>
          Passer au plan Pro
        </button>
      </div>
    </div>
  );
};
