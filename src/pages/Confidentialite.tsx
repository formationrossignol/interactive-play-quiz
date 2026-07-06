import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: "32px" }}>
    <h2 style={{ fontFamily: "var(--ap-font-display)", fontSize: "20px", fontWeight: 600, marginBottom: "12px", color: "var(--ap-ink)" }}>
      {title}
    </h2>
    <div style={{ color: "var(--ap-muted)", lineHeight: "1.7", fontSize: "15px" }}>{children}</div>
  </section>
);

const Confidentialite = () => {
  useSEO({ title: "Politique de confidentialité", path: "/confidentialite" });
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "var(--ap-paper)" }}>
      <Header />
      <main style={{ flex: 1, maxWidth: "760px", margin: "0 auto", padding: "60px 24px" }}>
        <h1 style={{ fontFamily: "var(--ap-font-display)", fontSize: "36px", fontWeight: 600, marginBottom: "8px", color: "var(--ap-ink)" }}>
          Politique de confidentialité
        </h1>
        <p style={{ color: "var(--ap-muted)", fontSize: "14px", marginBottom: "48px" }}>
          Conformément au RGPD (UE) 2016/679 et à la loi Informatique et Libertés
        </p>

        <Section title="Responsable du traitement">
          <p>
            <strong>[Nom de la société / Porteur de projet]</strong><br />
            [Adresse]<br />
            Email DPO / contact RGPD :{" "}
            <a href="mailto:privacy@quizmaster.app" style={{ color: "var(--ap-brand)" }}>privacy@quizmaster.app</a>
          </p>
        </Section>

        <Section title="Données collectées et finalités">
          <p style={{ marginBottom: "12px" }}>Ludiq collecte les données suivantes :</p>
          <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
            <li style={{ marginBottom: "8px" }}>
              <strong>Compte utilisateur</strong> : adresse e-mail, nom d'utilisateur, mot de passe haché.
              Finalité : authentification et gestion du compte. Base légale : exécution du contrat (art. 6.1.b).
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Données de quiz</strong> : contenu des quiz créés, scores des participants.
              Finalité : fourniture du service. Base légale : exécution du contrat (art. 6.1.b).
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Données de navigation</strong> : logs techniques (adresse IP, user-agent) conservés par
              l'hébergeur Vercel à des fins de sécurité. Durée : 90 jours maximum.
            </li>
          </ul>
        </Section>

        <Section title="Sous-traitants et transferts">
          <p style={{ marginBottom: "12px" }}>Ludiq fait appel aux sous-traitants suivants :</p>
          <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
            <li style={{ marginBottom: "8px" }}>
              <strong>Supabase</strong> (stockage et authentification), serveurs en Europe (eu-west-1).
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Vercel</strong> (hébergement), conforme aux clauses contractuelles types de l'UE.
            </li>
          </ul>
          <p style={{ marginTop: "8px" }}>
            Les polices de caractères sont auto-hébergées : aucun appel vers Google Fonts ou autre CDN tiers.
          </p>
        </Section>

        <Section title="Durée de conservation">
          <p>
            Les données de compte sont conservées jusqu'à la suppression du compte et 30 jours après
            (purge définitive). Les données de quiz publics anonymisés peuvent être conservées plus longtemps
            à des fins statistiques agrégées.
          </p>
        </Section>

        <Section title="Vos droits">
          <p style={{ marginBottom: "8px" }}>
            Conformément au RGPD, vous disposez des droits suivants : accès, rectification, effacement,
            portabilité, opposition et limitation du traitement.
          </p>
          <p>
            Pour exercer ces droits, contactez-nous à{" "}
            <a href="mailto:privacy@quizmaster.app" style={{ color: "var(--ap-brand)" }}>privacy@quizmaster.app</a>.
            Vous pouvez également introduire une réclamation auprès de la{" "}
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ap-brand)" }}>
              CNIL
            </a>.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Cookies strictement nécessaires uniquement (session, préférences de langue).
            Pas de cookies publicitaires, pas de traceurs tiers. Aucun consentement n'est requis
            pour ces cookies (art. 82 loi Informatique et Libertés, exemption CNIL).
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

export default Confidentialite;
