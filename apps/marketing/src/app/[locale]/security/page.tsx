import type { Metadata } from "next";
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
      title: "Security and Trust Center",
      description: "Review Brivia's current controls, public documents and stated security limitations.",
      alternates: { canonical: "/en/security", languages: { fr: "/security", en: "/en/security", "x-default": "/security" } },
      openGraph: {
        title: "Brivia Security and Trust Center",
        description: "Review Brivia's current controls, public documents and stated security limitations.",
        url: "/en/security",
        locale: "en_US",
        alternateLocale: ["fr_FR"],
      },
      twitter: {
        card: "summary_large_image",
        title: "Brivia Security and Trust Center",
        description: "Review Brivia's current controls, public documents and stated security limitations.",
        images: ["/opengraph-image"],
      },
    };
  }

  return {
    title: "Sécurité et confiance",
    description: "Consultez les contrôles actuels, les documents publics et les limites du dossier de confiance Brivia.",
    alternates: { canonical: "/security", languages: { fr: "/security", en: "/en/security", "x-default": "/security" } },
    openGraph: {
      title: "Sécurité et centre de confiance Brivia",
      description: "Consultez les contrôles actuels, les documents publics et les limites déclarées par Brivia.",
      url: "/security",
      locale: "fr_FR",
      alternateLocale: ["en_US"],
    },
  };
}

const FRENCH_CONTROLS = [
  { area: "Données", title: "Région européenne", text: "Les données applicatives sont hébergées dans une région européenne déclarée.", status: "Documenté" },
  { area: "Transport", title: "Connexion chiffrée", text: "Les services hébergés utilisent TLS pour les échanges réseau.", status: "Disponible" },
  { area: "Accès", title: "Contrôles applicatifs", text: "Les espaces de création sont authentifiés et les accès sont séparés selon leur besoin.", status: "Disponible" },
  { area: "Participants", title: "Accès public minimal", text: "Une session publique peut être rejointe sans créer de compte participant.", status: "Disponible" },
] as const;

const ENGLISH_CONTROLS = [
  { area: "Data", title: "European region", text: "Application data is hosted in a stated European region.", status: "Documented" },
  { area: "Transport", title: "Encrypted connection", text: "Hosted services use TLS for network exchanges.", status: "Available" },
  { area: "Access", title: "Application controls", text: "Authoring spaces require authentication and access is separated according to need.", status: "Available" },
  { area: "Participants", title: "Minimal public access", text: "A public session can be joined without creating a participant account.", status: "Available" },
] as const;

const FRENCH_LIMITS = [
  "Aucune certification ISO 27001 ou SOC 2 n’est revendiquée actuellement.",
  "Les audits indépendants et tests d’intrusion doivent être planifiés selon le périmètre attendu.",
  "Le SSO, le DPA et les exigences contractuelles sont qualifiés avec chaque organisation.",
] as const;

const ENGLISH_LIMITS = [
  "Brivia does not currently claim ISO 27001 or SOC 2 certification.",
  "Independent audits and penetration tests must be planned for the expected scope.",
  "SSO, the DPA and contractual requirements are qualified with each organization.",
] as const;

export default async function SecurityPage({ params }: Props) {
  const { locale } = await params;
  const english = locale === "en";
  const CONTROLS = english ? ENGLISH_CONTROLS : FRENCH_CONTROLS;
  const LIMITS = english ? ENGLISH_LIMITS : FRENCH_LIMITS;

  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.securityPage}>
        <section className={styles.securityHero} aria-labelledby="security-title">
          <div className={styles.securityHeroCopy}>
            <p className={styles.securityEyebrow}>{english ? "Trust Center" : "Centre de confiance"}</p>
            <h1 id="security-title">{english ? "Trust should be documented." : "La confiance se documente."}</h1>
            <p>{english ? "Available controls, planned work and contractual commitments keep their actual status." : "Contrôles disponibles, travaux à mener et engagements contractuels gardent chacun leur véritable statut."}</p>
            <div className={styles.securityActions}>
              <Link href="#controls-title" data-marketing-cta={english ? "en_security_controls" : "security_controls"}>{english ? "Review controls" : "Voir les contrôles"} <ProductGlyph name="arrow" /></Link>
              <Link href="/confidentialite">{english ? "Read privacy policy" : "Lire la confidentialité"}</Link>
            </div>
          </div>
          <div className={styles.trustSeal} aria-label={english ? "Active transparency" : "Transparence active"}>
            <div className={styles.trustSealCore}>
              <ProductGlyph name="security" />
              <strong>{english ? "Active transparency" : "Transparence active"}</strong>
              <span>{english ? "Updated with the product" : "Mis à jour avec le produit"}</span>
            </div>
            <span className={styles.trustOrbitOne} aria-hidden="true" />
            <span className={styles.trustOrbitTwo} aria-hidden="true" />
          </div>
        </section>

        <section className={styles.controlSection} aria-labelledby="controls-title">
          <div className={styles.controlHeading}>
            <h2 id="controls-title">{english ? "Current control status." : "État actuel des contrôles."}</h2>
            <p>{english ? "These statements are deliberately precise. They do not replace a security review for your specific scope." : "Ces formulations restent volontairement précises. Elles ne remplacent pas une revue de sécurité adaptée à votre périmètre."}</p>
          </div>
          <div className={styles.controlTable} role="list">
            {CONTROLS.map((control) => (
              <article key={control.title} role="listitem">
                <span>{control.area}</span>
                <div><h3>{control.title}</h3><p>{control.text}</p></div>
                <strong>{control.status}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.trustDocuments} aria-labelledby="documents-title">
          <div className={styles.documentIntro}>
            <h2 id="documents-title">{english ? "The public record, directly accessible." : "Le dossier public, sans intermédiaire."}</h2>
            <p>{english ? "Available documents can be shared with legal, security and procurement teams." : "Les documents disponibles peuvent être transmis à votre équipe juridique, sécurité ou achats."}</p>
          </div>
          <div className={styles.documentLinks}>
            <Link href="/confidentialite">
              <span>{english ? "Data processing" : "Traitement des données"}</span><strong>{english ? "Privacy" : "Confidentialité"}</strong><ProductGlyph name="external" />
            </Link>
            <Link href="/accessibility">
              <span>{english ? "Inclusive use" : "Usage inclusif"}</span><strong>{english ? "Accessibility" : "Accessibilité"}</strong><ProductGlyph name="external" />
            </Link>
            <Link href="/cgu">
              <span>{english ? "Use framework" : "Cadre d’utilisation"}</span><strong>{english ? "Terms" : "Conditions générales"}</strong><ProductGlyph name="external" />
            </Link>
          </div>
        </section>

        <section className={styles.limitSection} aria-labelledby="limits-title">
          <div>
            <h2 id="limits-title">{english ? "What Brivia does not claim." : "Ce que nous ne prétendons pas."}</h2>
            <p>{english ? "Trust improves when limitations remain as visible as controls." : "La confiance augmente lorsque les limites restent aussi visibles que les contrôles."}</p>
          </div>
          <ul>
            {LIMITS.map((limit) => <li key={limit}><ProductGlyph name="partial" /><span>{limit}</span></li>)}
          </ul>
        </section>

        <section className={styles.securityClosing}>
          <div>
            <h2>{english ? "Your questionnaire deserves factual answers." : "Votre questionnaire mérite des réponses factuelles."}</h2>
            <p>{english ? "Send your requirements and review timeline. We will answer each point directly." : "Envoyez vos exigences et le calendrier de votre revue. Nous répondrons point par point."}</p>
          </div>
          <Link href={english ? "/en/contact?intent=security" : "/contact?intent=security"} data-marketing-cta={english ? "en_security_questionnaire" : "security_questionnaire"}>{english ? "Contact security" : "Contacter l’équipe sécurité"} <ProductGlyph name="arrow" /></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
