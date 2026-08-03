import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductGlyph } from "@/components/ProductGlyph";
import styles from "@/components/TrustPages.module.css";

export const metadata: Metadata = {
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

const DECISION_AREAS = [
  {
    label: "Usage",
    title: "Une expérience cohérente",
    detail: "Direct, cours et évaluation dans un espace commun, sans compte pour rejoindre une session publique.",
    href: "/features",
    glyph: "live" as const,
  },
  {
    label: "Gouvernance",
    title: "Des rôles lisibles",
    detail: "Organisations, groupes, contenus partagés et exports sont cadrés selon le déploiement retenu.",
    href: "/features#collaboration",
    glyph: "collaboration" as const,
  },
  {
    label: "Confiance",
    title: "Un dossier factuel",
    detail: "Données, contrôles actuels et limites sont distingués des engagements à contractualiser.",
    href: "/security",
    glyph: "security" as const,
  },
] as const;

const DEPLOYMENT = [
  ["Cadrage", "Publics, formats, volume, calendrier et critères de réussite."],
  ["Configuration", "Espaces, rôles, contenus communs et règles de restitution."],
  ["Lancement", "Session pilote, accompagnement des équipes et point de contrôle."],
  ["Suivi", "Résultats, retours d’usage et ajustements documentés."],
] as const;

export default function EnterprisePage() {
  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.enterprisePage}>
        <section className={styles.enterpriseHero} aria-labelledby="enterprise-title">
          <div className={styles.enterpriseHeroCopy}>
            <p className={styles.enterpriseEyebrow}>Brivia pour les organisations</p>
            <h1 id="enterprise-title">Décidez sur des faits.</h1>
            <p>Nous préparons la démonstration autour de votre public, de vos flux et de vos exigences réelles.</p>
            <div className={styles.enterpriseActions}>
              <Link className={styles.enterprisePrimary} href="#decision-title" data-marketing-cta="enterprise_criteria">
                Voir les critères <ProductGlyph name="arrow" />
              </Link>
              <Link className={styles.enterpriseSecondary} href="/security" data-marketing-cta="enterprise_trust">Ouvrir le dossier de confiance</Link>
            </div>
          </div>
          <div className={styles.enterpriseHeroMedia}>
            <Image
              src="/images/brivia-platform-control.jpg"
              alt="Une équipe pilote une expérience Brivia dans un environnement professionnel"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
            />
            <div className={styles.enterpriseMediaCaption}>
              <span>Votre contexte</span>
              <strong>avant notre démonstration</strong>
            </div>
          </div>
        </section>

        <section className={styles.decisionSection} aria-labelledby="decision-title">
          <div className={styles.decisionHeading}>
            <h2 id="decision-title">Trois dossiers. Une décision claire.</h2>
            <p>Chaque conversation Enterprise doit répondre à ces trois dimensions sans diluer les responsabilités.</p>
          </div>
          <div className={styles.decisionGrid}>
            {DECISION_AREAS.map((area) => (
              <Link href={area.href} key={area.label} className={styles.decisionArea}>
                <div className={styles.decisionAreaTop}>
                  <span>{area.label}</span>
                  <ProductGlyph name={area.glyph} />
                </div>
                <h3>{area.title}</h3>
                <p>{area.detail}</p>
                <b>Explorer <ProductGlyph name="arrow" /></b>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.enterpriseProof} aria-labelledby="enterprise-proof-title">
          <div className={styles.enterpriseProofIntro}>
            <h2 id="enterprise-proof-title">Ce que votre équipe peut vérifier maintenant.</h2>
            <p>Les engagements sur les volumes, le support, l’authentification ou les intégrations sont définis dans la proposition, pas dans une promesse générale.</p>
          </div>
          <div className={styles.enterpriseProofList}>
            <article>
              <span>01</span>
              <div><strong>Accès participant</strong><p>Aucun compte requis pour rejoindre une session publique.</p></div>
              <b>Disponible</b>
            </article>
            <article>
              <span>02</span>
              <div><strong>Implantation des données</strong><p>Région européenne déclarée pour les données applicatives.</p></div>
              <b>Documenté</b>
            </article>
            <article>
              <span>03</span>
              <div><strong>SSO et exigences spécifiques</strong><p>Le périmètre est étudié pendant la qualification Enterprise.</p></div>
              <b className={styles.proofContract}>À cadrer</b>
            </article>
          </div>
        </section>

        <section className={styles.deploymentSection} aria-labelledby="deployment-title">
          <div className={styles.deploymentTitle}>
            <h2 id="deployment-title">Le déploiement garde un rythme humain.</h2>
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
            <h2>Montrez-nous votre réalité.</h2>
            <p>Audience, calendrier, outils, gouvernance. Nous préparerons une démonstration qui répond à votre décision.</p>
          </div>
          <Link href="/contact?intent=enterprise" data-marketing-cta="enterprise_demo">Préparer la démonstration <ProductGlyph name="arrow" /></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
