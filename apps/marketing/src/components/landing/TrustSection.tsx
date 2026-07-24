import { ShieldCheck, UserX, CreditCard } from "lucide-react";

/** Mirrors apps/app/src/components/landing/TrustSection.tsx. */
const ITEMS = [
  { icon: ShieldCheck, text: "Données hébergées en Europe · conforme RGPD" },
  { icon: UserX, text: "Aucun compte requis pour les participants" },
  { icon: CreditCard, text: "Paiement sécurisé via Stripe pour le plan Pro" },
];

export const TrustSection = () => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
    {ITEMS.map(({ icon: Icon, text }) => (
      <div key={text} className="ap-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 22px" }}>
        <Icon style={{ width: 22, height: 22, color: "var(--ap-brand)", flexShrink: 0 }} />
        <span style={{ fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: 14, color: "var(--ap-ink)" }}>{text}</span>
      </div>
    ))}
  </div>
);
