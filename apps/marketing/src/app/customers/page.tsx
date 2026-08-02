import type { Metadata } from "next";
import { AuthorityPage } from "@/components/AuthorityPage";

export const metadata: Metadata = {
  title: "Résultats et références",
  description: "La méthode Brivia pour publier des retours et études de cas vérifiables, sans chiffres ni logos décoratifs.",
  alternates: { canonical: "/customers" },
};

export default function CustomersPage() {
  return <AuthorityPage
    layout="editorial"
    eyebrow="Preuves et références"
    title="Une preuve vaut plus qu’une"
    accent="rangée de logos."
    introduction="Brivia publie uniquement les témoignages et résultats dont la source, le contexte et l’autorisation peuvent être établis. Les études nominatives arriveront au rythme de leur validation."
    signal="Preuve avant promotion"
    signalDetail="Pas de volume inventé, pas de client insinué, pas de résultat sorti de son contexte."
    facts={[
      { value: "Nom", label: "Une organisation identifiable ou un anonymat expliqué" },
      { value: "Contexte", label: "Public, format, durée et objectif de la session" },
      { value: "Résultat", label: "Une mesure ou un enseignement documenté" },
    ]}
    chapters={[
      { index: "01 — Protocole", title: "Documenter le point de départ.", text: "Une étude utile commence avant la session, avec un objectif et un indicateur défini.", points: ["Contexte, audience et contrainte explicités.", "Critère de réussite choisi avec l’organisation.", "Autorisation de publication enregistrée." ] },
      { index: "02 — Observation", title: "Mesurer sans embellir.", text: "Les données quantitatives et qualitatives restent séparées pour éviter les raccourcis.", points: ["Participation et complétion lorsque disponibles.", "Retours des animateurs et participants attribués.", "Limites du test et enseignements négatifs conservés." ] },
      { index: "03 — Publication", title: "Rendre la preuve vérifiable.", text: "Chaque cas publié indiquera qui parle, de quoi et avec quel résultat.", points: ["Nom, fonction et organisation avec consentement.", "Captures ou démonstration du parcours utilisé.", "Date, périmètre et méthode de mesure."], note: "Aucune marque n’est présentée comme cliente tant que son accord de publication n’est pas documenté." },
    ]}
    closingTitle="Devenez un cas pilote documenté."
    closingText="Nous pouvons cadrer avec vous un scénario, ses indicateurs et les conditions de publication du retour."
    primaryLabel="Proposer un pilote"
    primaryHref="/contact?intent=pilot"
    secondaryLabel="Lire les retours publiés"
    secondaryHref="/reviews"
  />;
}
