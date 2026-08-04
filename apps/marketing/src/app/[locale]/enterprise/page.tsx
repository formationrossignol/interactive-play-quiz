import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductGlyph } from "@/components/ProductGlyph";
import styles from "@/components/TrustPages.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (locale === "en") {
    return {
      title: "Brivia for organizations",
      description: "Frame a Brivia deployment around your audiences, governance, data, workflows and security requirements.",
      alternates: { canonical: "/en/enterprise", languages: { fr: "/enterprise", en: "/en/enterprise", "x-default": "/enterprise" } },
      openGraph: {
        title: "Brivia for organizations",
        description: "Frame a Brivia deployment around your audiences, governance, workflows and security requirements.",
        url: "/en/enterprise",
        locale: "en_US",
        alternateLocale: ["fr_FR"],
      },
      twitter: {
        card: "summary_large_image",
        title: "Brivia for organizations",
        description: "Frame a Brivia deployment around your audiences, governance, workflows and security requirements.",
        images: ["/opengraph-image"],
      },
    };
  }

  return {
    title: "Brivia pour les organisations",
    description: "Cadrez le déploiement de Brivia autour de vos usages, de votre gouvernance, de vos données et de vos équipes.",
    alternates: { canonical: "/enterprise", languages: { fr: "/enterprise", en: "/en/enterprise", "x-default": "/enterprise" } },
    openGraph: {
      title: "Brivia pour les organisations",
      description: "Cadrez un déploiement Brivia autour de vos usages, de votre gouvernance et de vos exigences.",
      url: "/enterprise",
      locale: "fr_FR",
      alternateLocale: ["en_US"],
    },
  };
}

const FRENCH_AREAS = [
  { label: "Usage", title: "Une expérience cohérente", detail: "Direct, cours et évaluation dans un espace commun, sans compte pour rejoindre une session publique.", href: "/features", glyph: "live" as const },
  { label: "Gouvernance", title: "Des rôles lisibles", detail: "Organisations, groupes, contenus partagés et exports sont cadrés selon le déploiement retenu.", href: "/features#collaboration", glyph: "collaboration" as const },
  { label: "Confiance", title: "Un dossier factuel", detail: "Données, contrôles actuels et limites sont distingués des engagements à contractualiser.", href: "/security", glyph: "security" as const },
] as const;

const ENGLISH_AREAS = [
  { label: "Use", title: "One coherent experience", detail: "Live sessions, learning and assessment in a shared environment, with no account required to join a public session.", href: "/en#product", glyph: "live" as const },
  { label: "Governance", title: "Roles people can understand", detail: "Organizations, groups, shared content and exports are framed around the deployment you choose.", href: "/en#learning", glyph: "collaboration" as const },
  { label: "Trust", title: "A factual review", detail: "Current controls and limitations remain separate from commitments that require a contract.", href: "/en/security", glyph: "security" as const },
] as const;

const FRENCH_DEPLOYMENT = [
  ["Cadrage", "Publics, formats, volume, calendrier et critères de réussite."],
  ["Configuration", "Espaces, rôles, contenus communs et règles de restitution."],
  ["Lancement", "Session pilote, accompagnement des équipes et point de contrôle."],
  ["Suivi", "Résultats, retours d’usage et ajustements documentés."],
] as const;

const ENGLISH_DEPLOYMENT = [
  ["Discovery", "Audiences, formats, volume, timeline and success criteria."],
  ["Configuration", "Spaces, roles, shared content and reporting rules."],
  ["Launch", "A pilot session, team support and an explicit review point."],
  ["Follow-up", "Results, usage feedback and documented adjustments."],
] as const;

export default async function EnterprisePage({ params }: Props) {
  const { locale } = await params;
  const english = locale === "en";
  const AREAS = english ? ENGLISH_AREAS : FRENCH_AREAS;
  const DEPLOYMENT = english ? ENGLISH_DEPLOYMENT : FRENCH_DEPLOYMENT;

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.enterprisePage}>
        <section className={styles.enterpriseHero} aria-labelledby="enterprise-title">
          <div className={styles.enterpriseHeroCopy}>
            <p className={styles.enterpriseEyebrow}>{english ? "Brivia for organizations" : "Brivia pour les organisations"}</p>
            <h1 id="enterprise-title">{english ? "Decide with facts." : "Décidez sur des faits."}</h1>
            <p>{english ? "We prepare the demonstration around your audience, workflows and actual requirements." : "Nous préparons la démonstration autour de votre public, de vos flux et de vos exigences réelles."}</p>
            <div className={styles.enterpriseActions}>
              <Link className={styles.enterprisePrimary} href="#decision-title" data-marketing-cta={english ? "en_enterprise_criteria" : "enterprise_criteria"}>
                {english ? "Review the criteria" : "Voir les critères"} <ProductGlyph name="arrow" />
              </Link>
              <Link className={styles.enterpriseSecondary} href={english ? "/en/security" : "/security"} data-marketing-cta={english ? "en_enterprise_trust" : "enterprise_trust"}>{english ? "Open the Trust Center" : "Ouvrir le dossier de confiance"}</Link>
            </div>
          </div>
          <div className={styles.enterpriseHeroMedia}>
            <Image
              src="/images/brivia-platform-control.jpg"
              alt={english ? "A professional reviews an interactive learning platform in a modern workspace" : "Une équipe pilote une expérience Brivia dans un environnement professionnel"}
              fill
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
            />
            <div className={styles.enterpriseMediaCaption}>
              <span>{english ? "Your context" : "Votre contexte"}</span>
              <strong>{english ? "before our demonstration" : "avant notre démonstration"}</strong>
            </div>
          </div>
        </section>

        <section className={styles.decisionSection} aria-labelledby="decision-title">
          <div className={styles.decisionHeading}>
            <h2 id="decision-title">{english ? "Three areas. One clear decision." : "Trois dossiers. Une décision claire."}</h2>
            <p>{english ? "Every Enterprise conversation should answer these dimensions without blurring responsibility." : "Chaque conversation Enterprise doit répondre à ces trois dimensions sans diluer les responsabilités."}</p>
          </div>
          <div className={styles.decisionGrid}>
            {AREAS.map((area) => (
              <Link href={area.href} key={area.label} className={styles.decisionArea}>
                <div className={styles.decisionAreaTop}>
                  <span>{area.label}</span>
                  <ProductGlyph name={area.glyph} />
                </div>
                <h3>{area.title}</h3>
                <p>{area.detail}</p>
                <b>{english ? "Explore" : "Explorer"} <ProductGlyph name="arrow" /></b>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.enterpriseProof} aria-labelledby="enterprise-proof-title">
          <div className={styles.enterpriseProofIntro}>
            <h2 id="enterprise-proof-title">{english ? "What your team can verify today." : "Ce que votre équipe peut vérifier maintenant."}</h2>
            <p>{english ? "Volume, support, authentication and integration commitments belong in a proposal, not in a generic claim." : "Les engagements sur les volumes, le support, l’authentification ou les intégrations sont définis dans la proposition, pas dans une promesse générale."}</p>
          </div>
          <div className={styles.enterpriseProofList}>
            <article>
              <span>01</span>
              <div><strong>{english ? "Participant access" : "Accès participant"}</strong><p>{english ? "No account is required to join a public live session." : "Aucun compte requis pour rejoindre une session publique."}</p></div>
              <b>{english ? "Available" : "Disponible"}</b>
            </article>
            <article>
              <span>02</span>
              <div><strong>{english ? "Data location" : "Implantation des données"}</strong><p>{english ? "A European region is stated for application data hosting." : "Région européenne déclarée pour les données applicatives."}</p></div>
              <b>{english ? "Documented" : "Documenté"}</b>
            </article>
            <article>
              <span>03</span>
              <div><strong>{english ? "SSO and specific requirements" : "SSO et exigences spécifiques"}</strong><p>{english ? "The scope is reviewed during Enterprise qualification." : "Le périmètre est étudié pendant la qualification Enterprise."}</p></div>
              <b className={styles.proofContract}>{english ? "To define" : "À cadrer"}</b>
            </article>
          </div>
        </section>

        <section className={styles.deploymentSection} aria-labelledby="deployment-title">
          <div className={styles.deploymentTitle}>
            <h2 id="deployment-title">{english ? "Deployment keeps a human rhythm." : "Le déploiement garde un rythme humain."}</h2>
          </div>
          <div className={styles.deploymentFlow}>
            {DEPLOYMENT.map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.enterpriseClosing}>
          <div>
            <ProductGlyph name="controls" />
            <h2>{english ? "Show us your reality." : "Montrez-nous votre réalité."}</h2>
            <p>{english ? "Audience, timeline, tools and governance. We will prepare a demonstration around your decision." : "Audience, calendrier, outils, gouvernance. Nous préparerons une démonstration qui répond à votre décision."}</p>
          </div>
          <Link href={english ? "/en/contact?intent=enterprise" : "/contact?intent=enterprise"} data-marketing-cta={english ? "en_enterprise_demo" : "enterprise_demo"}>{english ? "Prepare the demonstration" : "Préparer la démonstration"} <ProductGlyph name="arrow" /></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
