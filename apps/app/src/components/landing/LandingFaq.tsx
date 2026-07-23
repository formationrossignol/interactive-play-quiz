import { FaqAccordion } from "@/components/FaqAccordion";

/** Pre-sale objections for the landing page — distinct from the support
 *  FAQ on /help (useFaq()/Help.tsx) and from the billing-specific FAQ on
 *  /pricing (PaymentFaq.tsx). Grounded in PlanComparator.tsx caps and
 *  AuthPage.tsx's RGPD copy — no invented figures. */
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

export const LandingFaq = () => <FaqAccordion items={PRODUCT_FAQ} />;
