import type { Metadata } from "next";
import { AuthorityPage } from "@/components/AuthorityPage";

export const metadata: Metadata = {
  title: "Sécurité et confiance",
  description: "Architecture, données, accès et engagements de sécurité de Brivia, présentés sans revendication non vérifiée.",
  alternates: { canonical: "/security" },
};

export default function SecurityPage() {
  return <AuthorityPage
    layout="ledger"
    tone="emerald"
    eyebrow="Centre de confiance"
    title="La confiance se"
    accent="documente."
    introduction="Une vue claire de l’architecture, des données et des contrôles actuels. Les statuts sont explicites afin que votre équipe puisse évaluer Brivia sans zone grise."
    signal="Transparence active"
    signalDetail="Disponible, en préparation ou contractuel : chaque engagement conserve son vrai statut."
    facts={[
      { value: "UE", label: "Région déclarée pour les données applicatives" },
      { value: "TLS", label: "Transport chiffré sur les services hébergés" },
      { value: "RGPD", label: "Droits et finalités documentés publiquement" },
    ]}
    chapters={[
      { index: "01 — Données", title: "Collecter moins, expliquer mieux.", text: "Les données sont liées à une finalité produit identifiable et les participants publics peuvent rejoindre sans compte.", points: ["Comptes, contenus, réponses et résultats selon l’usage choisi.", "Sous-traitants principaux documentés dans la politique de confidentialité.", "Demandes d’accès, rectification et suppression via privacy@brivia.app."] },
      { index: "02 — Contrôles", title: "Des barrières à chaque couche.", text: "Les accès applicatifs, politiques de données et surfaces publiques sont séparés selon leur besoin.", points: ["Authentification et contrôle d’accès pour les espaces de création.", "Politiques de lecture et d’écriture appliquées au niveau des données.", "Formulaire marketing persistant, write-only côté public et limité par origine réseau." ] },
      { index: "03 — Assurance", title: "Aucune certification imaginaire.", text: "Le niveau de preuve doit progresser avec le produit et les attentes des organisations.", points: ["DPA, registre des sous-traitants et procédure d’incident à formaliser avec l’entité juridique.", "Tests d’intrusion et audits indépendants à planifier.", "SSO et exigences contractuelles examinés pendant la qualification Enterprise."], note: "Statut actuel : aucune certification ISO 27001 ou SOC 2 n’est revendiquée par Brivia." },
    ]}
    closingTitle="Votre équipe sécurité a des questions précises ?"
    closingText="Envoyez votre questionnaire ou vos exigences. Nous répondrons avec des éléments factuels, sans promesse générique."
    primaryLabel="Contacter l’équipe sécurité"
    primaryHref="/contact?intent=security"
    secondaryLabel="Lire la confidentialité"
    secondaryHref="/confidentialite"
  />;
}
