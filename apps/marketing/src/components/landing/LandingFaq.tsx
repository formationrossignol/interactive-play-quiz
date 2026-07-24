import { FaqAccordionItem } from "@/components/FaqAccordion";

/** Mirrors apps/app/src/components/landing/LandingFaq.tsx — pre-sale
 *  objections, distinct from /help's support FAQ and /pricing's billing FAQ. */
const PRODUCT_FAQ = [
  {
    q: "Est-ce vraiment gratuit pour commencer ?",
    a: "Oui. Le plan Starter est gratuit sans limite de durée : jusqu'à 5 contenus et 20 participants par session. Aucune carte bancaire requise pour démarrer.",
  },
  {
    q: "Mes participants doivent-ils créer un compte ?",
    a: "Non. Ils rejoignent une session avec un code à 6 chiffres ou un QR code, directement depuis leur navigateur, sans compte ni installation.",
  },
  {
    q: "Où sont hébergées nos données ?",
    a: "En Europe, conformément au RGPD.",
  },
  {
    q: "Puis-je changer de plan ou annuler à tout moment ?",
    a: "Oui, depuis votre profil, sans engagement ni préavis.",
  },
  {
    q: "Puis-je exporter les résultats de mes sessions ?",
    a: "Oui, à partir du plan Pro : rapports de performance détaillés et export des résultats.",
  },
];

export const LandingFaq = () => (
  <div className="ap-card" style={{ padding: "8px 28px" }}>
    {PRODUCT_FAQ.map((item) => (
      <FaqAccordionItem key={item.q} q={item.q} a={item.a} />
    ))}
  </div>
);
