import { FaqAccordion } from "@/components/FaqAccordion";

/** Grounded in the current Stripe integration (Checkout + Billing Portal,
 *  no trial, no annual tier, monthly $19 Pro plan — see
 *  docs/superpowers/specs/2026-07-18-stripe-billing-design.md). */
const PAYMENT_FAQ = [
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
];

export const PaymentFaq = () => <FaqAccordion items={PAYMENT_FAQ} />;
