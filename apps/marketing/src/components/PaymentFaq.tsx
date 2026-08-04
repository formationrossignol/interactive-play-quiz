import { FaqAccordionItem } from "@/components/FaqAccordion";

/** Mirrors apps/app/src/components/PaymentFaq.tsx — grounded in the current
 *  Stripe integration (Checkout + Billing Portal, no trial, no annual tier,
 *  monthly 19€ Pro plan). */
const PAYMENT_FAQ = {
  fr: [
    {
      q: "Quels moyens de paiement acceptez-vous ?",
      a: "Le plan Pro se paie par carte bancaire via Stripe, notre prestataire de paiement sécurisé. Vos coordonnées bancaires ne transitent jamais par nos serveurs.",
    },
    {
      q: "Puis-je annuler mon abonnement à tout moment ?",
      a: "Oui. Depuis votre profil, ouvrez le portail de facturation Stripe pour annuler en un clic. L'accès Pro reste actif jusqu'à la fin de la période déjà payée, puis votre compte repasse automatiquement en Starter.",
    },
    {
      q: "Y a-t-il une période d'essai gratuite ?",
      a: "Il n'existe pas d'essai séparé, mais le plan Starter est gratuit sans limite de durée (jusqu'à 5 contenus et 20 participants par session) : de quoi tester Brivia avant de passer au plan Pro.",
    },
    {
      q: "La facturation est-elle mensuelle ou annuelle ?",
      a: "Le plan Pro est facturé 19 €/mois, sans engagement. Il n'existe pas encore de formule annuelle.",
    },
    {
      q: "Que se passe-t-il si mon paiement échoue ?",
      a: "Stripe retente automatiquement le prélèvement pendant quelques jours ; votre accès Pro reste actif durant cette période. Si le paiement échoue définitivement, votre compte repasse en plan Starter.",
    },
    {
      q: "Puis-je récupérer mes factures ?",
      a: "Oui, l'historique complet de vos factures est disponible à tout moment dans le portail de facturation Stripe, accessible depuis votre profil.",
    },
    {
      q: "Comment fonctionne la facturation du plan Entreprise ?",
      a: "Le plan Entreprise est sur devis : contactez notre équipe commerciale pour définir vos besoins, le mode de facturation est alors adapté à votre organisation.",
    },
  ],
  en: [
    {
      q: "What payment methods do you accept?",
      a: "The Pro plan is paid by card through Stripe, our secure payment processor. Your card details never pass through our servers.",
    },
    {
      q: "Can I cancel my subscription at any time?",
      a: "Yes. From your profile, open the Stripe billing portal to cancel in one click. Pro access stays active until the end of the period already paid for, then your account automatically returns to Starter.",
    },
    {
      q: "Is there a free trial?",
      a: "There's no separate trial, but the Starter plan is free with no time limit (up to 5 pieces of content and 20 participants per session) — enough to try Brivia before moving to Pro.",
    },
    {
      q: "Is billing monthly or annual?",
      a: "The Pro plan is billed €19/month, with no commitment. There's no annual plan yet.",
    },
    {
      q: "What happens if my payment fails?",
      a: "Stripe automatically retries the charge for a few days; your Pro access stays active during that period. If the payment ultimately fails, your account moves back to the Starter plan.",
    },
    {
      q: "Can I retrieve my invoices?",
      a: "Yes, your full invoice history is available at any time in the Stripe billing portal, accessible from your profile.",
    },
    {
      q: "How does Enterprise plan billing work?",
      a: "The Enterprise plan is quote-based: contact our sales team to define your needs, and billing is adapted to your organization.",
    },
  ],
} as const;

export const PaymentFaq = ({ language = "fr" }: { language?: "fr" | "en" }) => (
  <div className="ap-card" style={{ padding: "8px 28px" }}>
    {PAYMENT_FAQ[language].map((item) => (
      <FaqAccordionItem key={item.q} q={item.q} a={item.a} />
    ))}
  </div>
);
