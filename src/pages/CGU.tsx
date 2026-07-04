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

const CGU = () => {
  usePageTitle("Conditions générales d'utilisation");
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "var(--ap-paper)" }}>
      <Header />
      <main style={{ flex: 1, maxWidth: "760px", margin: "0 auto", padding: "60px 24px" }}>
        <h1 style={{ fontFamily: "var(--ap-font-display)", fontSize: "36px", fontWeight: 600, marginBottom: "8px", color: "var(--ap-ink)" }}>
          Conditions générales d'utilisation
        </h1>
        <p style={{ color: "var(--ap-muted)", fontSize: "14px", marginBottom: "48px" }}>
          En vigueur au 1er juillet 2026
        </p>

        <Section title="1. Objet">
          <p>
            Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation
            du service Ludiq, plateforme de création de quiz interactifs, sondages et présentations
            en temps réel. Tout accès au service vaut acceptation des présentes CGU.
          </p>
        </Section>

        <Section title="2. Accès au service">
          <p>
            Ludiq est accessible via navigateur web. La création de contenu nécessite la création
            d'un compte. La participation à un quiz public ne nécessite pas de compte. L'accès au service
            est gratuit dans les limites du plan Starter ; des plans payants sont disponibles pour les
            fonctionnalités avancées.
          </p>
        </Section>

        <Section title="3. Création de compte">
          <p>
            L'utilisateur s'engage à fournir des informations exactes lors de la création de son compte
            et à maintenir la confidentialité de ses identifiants. Toute activité effectuée depuis un compte
            est réputée effectuée par son titulaire.
          </p>
        </Section>

        <Section title="4. Contenu utilisateur">
          <p style={{ marginBottom: "8px" }}>
            L'utilisateur reste propriétaire du contenu qu'il crée. En publiant du contenu sur Ludiq,
            il accorde à Ludiq une licence non exclusive, mondiale et gratuite pour héberger, afficher
            et distribuer ce contenu dans le cadre du service.
          </p>
          <p>
            L'utilisateur s'engage à ne pas publier de contenu illicite, diffamatoire, discriminatoire
            ou portant atteinte aux droits de tiers. Ludiq se réserve le droit de supprimer tout
            contenu non conforme.
          </p>
        </Section>

        <Section title="5. Responsabilité">
          <p>
            Ludiq est fourni « en l'état ». Ludiq ne saurait être tenu responsable des
            interruptions de service, des pertes de données ou des dommages indirects. La responsabilité
            de Ludiq est limitée au montant des sommes versées par l'utilisateur au cours des
            12 derniers mois.
          </p>
        </Section>

        <Section title="6. Résiliation">
          <p>
            L'utilisateur peut supprimer son compte à tout moment depuis les paramètres de profil.
            Ludiq peut suspendre ou résilier un compte en cas de violation des présentes CGU,
            après mise en demeure restée sans effet pendant 7 jours.
          </p>
        </Section>

        <Section title="7. Modifications">
          <p>
            Ludiq se réserve le droit de modifier les présentes CGU. Les utilisateurs sont informés
            par email de toute modification substantielle avec un préavis de 30 jours. L'utilisation
            continue du service après ce délai vaut acceptation des nouvelles CGU.
          </p>
        </Section>

        <Section title="8. Droit applicable et juridiction">
          <p>
            Les présentes CGU sont soumises au droit français. Tout litige relatif à leur interprétation
            ou à leur exécution sera soumis aux tribunaux compétents du ressort de Paris, sauf disposition
            légale impérative contraire.
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

export default CGU;
