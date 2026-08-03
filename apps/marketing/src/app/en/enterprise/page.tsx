import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductGlyph } from "@/components/ProductGlyph";
import styles from "@/components/TrustPages.module.css";

export const metadata: Metadata = {
  title: "Brivia for organizations",
  description: "Frame a Brivia deployment around your audiences, governance, data, workflows and security requirements.",
  alternates: {
    canonical: "/en/enterprise",
    languages: { fr: "/enterprise", en: "/en/enterprise", "x-default": "/enterprise" },
  },
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

const AREAS = [
  { label: "Use", title: "One coherent experience", detail: "Live sessions, learning and assessment in a shared environment, with no account required to join a public session.", href: "/en#product", glyph: "live" as const },
  { label: "Governance", title: "Roles people can understand", detail: "Organizations, groups, shared content and exports are framed around the deployment you choose.", href: "/en#learning", glyph: "collaboration" as const },
  { label: "Trust", title: "A factual review", detail: "Current controls and limitations remain separate from commitments that require a contract.", href: "/en/security", glyph: "security" as const },
] as const;

const DEPLOYMENT = [
  ["Discovery", "Audiences, formats, volume, timeline and success criteria."],
  ["Configuration", "Spaces, roles, shared content and reporting rules."],
  ["Launch", "A pilot session, team support and an explicit review point."],
  ["Follow-up", "Results, usage feedback and documented adjustments."],
] as const;

export default function EnglishEnterprisePage() {
  return (
    <div className="marketing-shell" lang="en">
      <Header />
      <main id="main-content" className={styles.enterprisePage}>
        <section className={styles.enterpriseHero} aria-labelledby="enterprise-title">
          <div className={styles.enterpriseHeroCopy}>
            <p className={styles.enterpriseEyebrow}>Brivia for organizations</p>
            <h1 id="enterprise-title">Decide with facts.</h1>
            <p>We prepare the demonstration around your audience, workflows and actual requirements.</p>
            <div className={styles.enterpriseActions}>
              <Link className={styles.enterprisePrimary} href="#decision-title" data-marketing-cta="en_enterprise_criteria">Review the criteria <ProductGlyph name="arrow" /></Link>
              <Link className={styles.enterpriseSecondary} href="/en/security" data-marketing-cta="en_enterprise_trust">Open the Trust Center</Link>
            </div>
          </div>
          <div className={styles.enterpriseHeroMedia}>
            <Image src="/images/brivia-platform-control.jpg" alt="A professional reviews an interactive learning platform in a modern workspace" fill priority sizes="(max-width: 900px) 100vw, 50vw" />
            <div className={styles.enterpriseMediaCaption}><span>Your context</span><strong>before our demonstration</strong></div>
          </div>
        </section>

        <section className={styles.decisionSection} aria-labelledby="decision-title">
          <div className={styles.decisionHeading}><h2 id="decision-title">Three areas. One clear decision.</h2><p>Every Enterprise conversation should answer these dimensions without blurring responsibility.</p></div>
          <div className={styles.decisionGrid}>
            {AREAS.map((area) => <Link href={area.href} key={area.label} className={styles.decisionArea}>
              <div className={styles.decisionAreaTop}><span>{area.label}</span><ProductGlyph name={area.glyph} /></div>
              <h3>{area.title}</h3><p>{area.detail}</p><b>Explore <ProductGlyph name="arrow" /></b>
            </Link>)}
          </div>
        </section>

        <section className={styles.enterpriseProof} aria-labelledby="enterprise-proof-title">
          <div className={styles.enterpriseProofIntro}><h2 id="enterprise-proof-title">What your team can verify today.</h2><p>Volume, support, authentication and integration commitments belong in a proposal, not in a generic claim.</p></div>
          <div className={styles.enterpriseProofList}>
            <article><span>01</span><div><strong>Participant access</strong><p>No account is required to join a public live session.</p></div><b>Available</b></article>
            <article><span>02</span><div><strong>Data location</strong><p>A European region is stated for application data hosting.</p></div><b>Documented</b></article>
            <article><span>03</span><div><strong>SSO and specific requirements</strong><p>The scope is reviewed during Enterprise qualification.</p></div><b className={styles.proofContract}>To define</b></article>
          </div>
        </section>

        <section className={styles.deploymentSection} aria-labelledby="deployment-title">
          <div className={styles.deploymentTitle}><h2 id="deployment-title">Deployment keeps a human rhythm.</h2></div>
          <div className={styles.deploymentFlow}>{DEPLOYMENT.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div>
        </section>

        <section className={styles.enterpriseClosing}>
          <div><ProductGlyph name="controls" /><h2>Show us your reality.</h2><p>Audience, timeline, tools and governance. We will prepare a demonstration around your decision.</p></div>
          <Link href="/en/contact?intent=enterprise" data-marketing-cta="en_enterprise_demo">Prepare the demonstration <ProductGlyph name="arrow" /></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
