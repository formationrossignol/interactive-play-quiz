import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductGlyph } from "@/components/ProductGlyph";
import styles from "@/components/TrustPages.module.css";

export const metadata: Metadata = {
  title: "Security and Trust Center",
  description: "Review Brivia's current controls, public documents and stated security limitations.",
  alternates: {
    canonical: "/en/security",
    languages: { fr: "/security", en: "/en/security", "x-default": "/security" },
  },
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

const CONTROLS = [
  { area: "Data", title: "European region", text: "Application data is hosted in a stated European region.", status: "Documented" },
  { area: "Transport", title: "Encrypted connection", text: "Hosted services use TLS for network exchanges.", status: "Available" },
  { area: "Access", title: "Application controls", text: "Authoring spaces require authentication and access is separated according to need.", status: "Available" },
  { area: "Participants", title: "Minimal public access", text: "A public session can be joined without creating a participant account.", status: "Available" },
] as const;

const LIMITS = [
  "Brivia does not currently claim ISO 27001 or SOC 2 certification.",
  "Independent audits and penetration tests must be planned for the expected scope.",
  "SSO, the DPA and contractual requirements are qualified with each organization.",
] as const;

export default function EnglishSecurityPage() {
  return (
    <div className="marketing-shell" lang="en">
      <Header />
      <main id="main-content" className={styles.securityPage}>
        <section className={styles.securityHero} aria-labelledby="security-title">
          <div className={styles.securityHeroCopy}>
            <p className={styles.securityEyebrow}>Trust Center</p>
            <h1 id="security-title">Trust should be documented.</h1>
            <p>Available controls, planned work and contractual commitments keep their actual status.</p>
            <div className={styles.securityActions}>
              <Link href="#controls-title" data-marketing-cta="en_security_controls">Review controls <ProductGlyph name="arrow" /></Link>
              <Link href="/confidentialite">Read privacy policy</Link>
            </div>
          </div>
          <div className={styles.trustSeal} aria-label="Active transparency">
            <div className={styles.trustSealCore}><ProductGlyph name="security" /><strong>Active transparency</strong><span>Updated with the product</span></div>
            <span className={styles.trustOrbitOne} aria-hidden="true" /><span className={styles.trustOrbitTwo} aria-hidden="true" />
          </div>
        </section>

        <section className={styles.controlSection} aria-labelledby="controls-title">
          <div className={styles.controlHeading}><h2 id="controls-title">Current control status.</h2><p>These statements are deliberately precise. They do not replace a security review for your specific scope.</p></div>
          <div className={styles.controlTable} role="list">{CONTROLS.map((control) => <article key={control.title} role="listitem"><span>{control.area}</span><div><h3>{control.title}</h3><p>{control.text}</p></div><strong>{control.status}</strong></article>)}</div>
        </section>

        <section className={styles.trustDocuments} aria-labelledby="documents-title">
          <div className={styles.documentIntro}><h2 id="documents-title">The public record, directly accessible.</h2><p>Available documents can be shared with legal, security and procurement teams.</p></div>
          <div className={styles.documentLinks}>
            <Link href="/confidentialite"><span>Data processing</span><strong>Privacy</strong><ProductGlyph name="external" /></Link>
            <Link href="/accessibility"><span>Inclusive use</span><strong>Accessibility</strong><ProductGlyph name="external" /></Link>
            <Link href="/cgu"><span>Use framework</span><strong>Terms</strong><ProductGlyph name="external" /></Link>
          </div>
        </section>

        <section className={styles.limitSection} aria-labelledby="limits-title">
          <div><h2 id="limits-title">What Brivia does not claim.</h2><p>Trust improves when limitations remain as visible as controls.</p></div>
          <ul>{LIMITS.map((limit) => <li key={limit}><ProductGlyph name="partial" /><span>{limit}</span></li>)}</ul>
        </section>

        <section className={styles.securityClosing}>
          <div><h2>Your questionnaire deserves factual answers.</h2><p>Send your requirements and review timeline. We will answer each point directly.</p></div>
          <Link href="/en/contact?intent=security" data-marketing-cta="en_security_questionnaire">Contact security <ProductGlyph name="arrow" /></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
