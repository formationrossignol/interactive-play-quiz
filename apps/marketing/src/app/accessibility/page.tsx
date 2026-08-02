import type { Metadata } from "next";
import { AuthorityPage } from "@/components/AuthorityPage";

export const metadata: Metadata = {
  title: "Accessibilité",
  description: "L’approche de Brivia pour une expérience utilisable au clavier, au lecteur d’écran et avec des préférences de mouvement réduites.",
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return <AuthorityPage
    layout="canvas"
    tone="blue"
    eyebrow="Accessibilité produit"
    title="Participer ne doit pas demander"
    accent="d’adaptation."
    introduction="Brivia construit ses parcours pour rester lisibles, navigables et compréhensibles dans des contextes, appareils et capacités variés."
    signal="Conception inclusive"
    signalDetail="L’accessibilité est traitée comme une qualité de produit continue, pas comme une page de conformité isolée."
    facts={[
      { value: "Clavier", label: "Navigation et actions essentielles sans souris" },
      { value: "Réduit", label: "Respect de la préférence de mouvement du système" },
      { value: "Lisible", label: "Libellés, états et messages d’erreur explicites" },
    ]}
    chapters={[
      { index: "01 — Parcours", title: "Un chemin compréhensible.", text: "Le participant doit savoir où il se trouve, ce qui est attendu et ce qui vient de se produire.", points: ["Titres, régions et liens d’évitement structurent les pages.", "Les formulaires associent libellés, aides et erreurs à leurs champs.", "Les résultats ne reposent pas uniquement sur la couleur." ] },
      { index: "02 — Mouvement", title: "Le rythme sans contrainte.", text: "L’animation doit donner du contexte sans gêner la lecture ou l’action.", points: ["Les préférences de mouvement réduit désactivent les animations non essentielles.", "Les transitions privilégient transformation et opacité.", "Les chronomètres et états critiques conservent une représentation textuelle." ] },
      { index: "03 — Validation", title: "Mesurer avant de revendiquer.", text: "La conformité exige des tests manuels et utilisateurs, au-delà des vérifications automatiques.", points: ["Audit clavier et lecteur d’écran des parcours prioritaires.", "Contrôle des contrastes, zoom, reflow et cibles tactiles.", "Publication progressive des écarts connus et corrections."], note: "Brivia vise WCAG 2.2 AA. Ce niveau n’est pas présenté comme certifié tant qu’un audit indépendant complet n’a pas été publié." },
    ]}
    closingTitle="Signalez une barrière, nous la traiterons."
    closingText="Décrivez la page, votre technologie d’assistance et le résultat attendu pour permettre une reproduction rapide."
    primaryLabel="Signaler un problème"
    primaryHref="/contact?intent=accessibility"
    secondaryLabel="Consulter le produit"
    secondaryHref="/features"
  />;
}
