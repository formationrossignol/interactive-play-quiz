import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { usePageTitle } from "@/hooks/usePageTitle";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: "32px" }}>
    <h2 style={{ fontFamily: "var(--ap-font-display)", fontSize: "20px", fontWeight: 600, marginBottom: "12px", color: "var(--ap-ink)" }}>
      {title}
    </h2>
    <div style={{ color: "var(--ap-muted)", lineHeight: "1.7", fontSize: "15px" }}>{children}</div>
  </section>
);

const MentionsLegales = () => {
  usePageTitle("Mentions légales");
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--ap-paper)" }}>
      <Header />
      <main style={{ flex: 1, maxWidth: "760px", margin: "0 auto", padding: "60px 24px" }}>
        <h1 style={{ fontFamily: "var(--ap-font-display)", fontSize: "36px", fontWeight: 600, marginBottom: "8px", color: "var(--ap-ink)" }}>
          Mentions légales
        </h1>
        <p style={{ color: "var(--ap-muted)", fontSize: "14px", marginBottom: "48px" }}>
          Conformément à la loi n° 2004-575 du 21 juin 2004 (LCEN)
        </p>

        <Section title="Éditeur du site">
          <p>QuizMaster est édité par :</p>
          <p style={{ marginTop: "8px" }}>
            <strong>[Nom de la société / Nom du porteur de projet]</strong><br />
            [Forme juridique — ex. : Auto-entrepreneur / SAS]<br />
            [Adresse complète]<br />
            [SIRET / RCS]<br />
            Email : <a href="mailto:contact@quizmaster.app" style={{ color: "var(--ap-brand)" }}>contact@quizmaster.app</a>
          </p>
        </Section>

        <Section title="Directeur de la publication">
          <p>[Prénom Nom], [Qualité]</p>
        </Section>

        <Section title="Hébergement">
          <p>
            Le site est hébergé par :<br />
            <strong>Vercel Inc.</strong><br />
            340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis<br />
            <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ap-brand)" }}>vercel.com</a>
          </p>
        </Section>

        <Section title="Propriété intellectuelle">
          <p>
            L'ensemble des contenus présents sur QuizMaster (textes, images, logotypes, icônes, sons)
            sont protégés par le droit de la propriété intellectuelle. Toute reproduction, représentation
            ou diffusion, en tout ou partie, sans autorisation expresse est interdite.
          </p>
        </Section>

        <Section title="Données personnelles">
          <p>
            Le traitement de vos données personnelles est décrit dans notre{" "}
            <a href="/confidentialite" style={{ color: "var(--ap-brand)" }}>Politique de confidentialité</a>.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            QuizMaster utilise des cookies strictement nécessaires au fonctionnement du service
            (authentification, préférences de langue). Aucun cookie publicitaire ou de traçage tiers
            n'est déposé sans votre consentement.
          </p>
        </Section>

        <Section title="Droit applicable">
          <p>
            Les présentes mentions légales sont soumises au droit français. Tout litige relatif à leur
            interprétation ou à leur exécution relève de la compétence des tribunaux français.
          </p>
        </Section>

        <p style={{ color: "var(--ap-muted)", fontSize: "13px", marginTop: "48px" }}>
          Dernière mise à jour : juillet 2026
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default MentionsLegales;
