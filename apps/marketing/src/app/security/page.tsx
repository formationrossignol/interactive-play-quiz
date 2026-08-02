import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductGlyph } from "@/components/ProductGlyph";
import styles from "@/components/TrustPages.module.css";

export const metadata: Metadata = {
  title: "Sécurité et confiance",
  description: "Consultez les contrôles actuels, les documents publics et les limites du dossier de confiance Brivia.",
  alternates: { canonical: "/security" },
};

const CONTROLS = [
  {
    area: "Données",
    title: "Région européenne",
    text: "Les données applicatives sont hébergées dans une région européenne déclarée.",
    status: "Documenté",
  },
  {
    area: "Transport",
    title: "Connexion chiffrée",
    text: "Les services hébergés utilisent TLS pour les échanges réseau.",
    status: "Disponible",
  },
  {
    area: "Accès",
    title: "Contrôles applicatifs",
    text: "Les espaces de création sont authentifiés et les accès sont séparés selon leur besoin.",
    status: "Disponible",
  },
  {
    area: "Participants",
    title: "Accès public minimal",
    text: "Une session publique peut être rejointe sans créer de compte participant.",
    status: "Disponible",
  },
] as const;

const LIMITS = [
  "Aucune certification ISO 27001 ou SOC 2 n’est revendiquée actuellement.",
  "Les audits indépendants et tests d’intrusion doivent être planifiés selon le périmètre attendu.",
  "Le SSO, le DPA et les exigences contractuelles sont qualifiés avec chaque organisation.",
] as const;

export default function SecurityPage() {
  return (
    <div className="marketing-shell">
      <Header />
      <main id="main-content" className={styles.securityPage}>
        <section className={styles.securityHero} aria-labelledby="security-title">
          <div className={styles.securityHeroCopy}>
            <p className={styles.securityEyebrow}>Centre de confiance</p>
            <h1 id="security-title">La confiance se documente.</h1>
            <p>Contrôles disponibles, travaux à mener et engagements contractuels gardent chacun leur véritable statut.</p>
            <div className={styles.securityActions}>
              <Link href="#controls-title" data-marketing-cta="security_controls">Voir les contrôles <ProductGlyph name="arrow" /></Link>
              <Link href="/confidentialite" data-marketing-cta="security_privacy">Lire la confidentialité</Link>
            </div>
          </div>
          <div className={styles.trustSeal} aria-label="Transparence active">
            <div className={styles.trustSealCore}>
              <ProductGlyph name="security" />
              <strong>Transparence active</strong>
              <span>Mis à jour avec le produit</span>
            </div>
            <span className={styles.trustOrbitOne} aria-hidden="true" />
            <span className={styles.trustOrbitTwo} aria-hidden="true" />
          </div>
        </section>

        <section className={styles.controlSection} aria-labelledby="controls-title">
          <div className={styles.controlHeading}>
            <h2 id="controls-title">État actuel des contrôles.</h2>
            <p>Ces formulations restent volontairement précises. Elles ne remplacent pas une revue de sécurité adaptée à votre périmètre.</p>
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
            <h2 id="documents-title">Le dossier public, sans intermédiaire.</h2>
            <p>Les documents disponibles peuvent être transmis à votre équipe juridique, sécurité ou achats.</p>
          </div>
          <div className={styles.documentLinks}>
            <Link href="/confidentialite">
              <span>Traitement des données</span><strong>Confidentialité</strong><ProductGlyph name="external" />
            </Link>
            <Link href="/accessibility">
              <span>Usage inclusif</span><strong>Accessibilité</strong><ProductGlyph name="external" />
            </Link>
            <Link href="/cgu">
              <span>Cadre d’utilisation</span><strong>Conditions générales</strong><ProductGlyph name="external" />
            </Link>
          </div>
        </section>

        <section className={styles.limitSection} aria-labelledby="limits-title">
          <div>
            <h2 id="limits-title">Ce que nous ne prétendons pas.</h2>
            <p>La confiance augmente lorsque les limites restent aussi visibles que les contrôles.</p>
          </div>
          <ul>
            {LIMITS.map((limit) => <li key={limit}><ProductGlyph name="partial" /><span>{limit}</span></li>)}
          </ul>
        </section>

        <section className={styles.securityClosing}>
          <div>
            <h2>Votre questionnaire mérite des réponses factuelles.</h2>
            <p>Envoyez vos exigences et le calendrier de votre revue. Nous répondrons point par point.</p>
          </div>
          <Link href="/contact?intent=security" data-marketing-cta="security_questionnaire">Contacter l’équipe sécurité <ProductGlyph name="arrow" /></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
