import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductGlyph } from "@/components/ProductGlyph";
import { SITE_URL } from "@/lib/siteUrl";
import styles from "@/components/EnglishHome.module.css";

export const metadata: Metadata = {
  title: "Interactive quizzes, learning and assessment",
  description: "Brivia brings live participation, learning activities and assessment into one interactive platform for educators, trainers and organizations.",
  alternates: {
    canonical: "/en",
    languages: { fr: "/", en: "/en", "x-default": "/" },
  },
  openGraph: {
    title: "Brivia - Every room becomes part of the answer",
    description: "Run live quizzes, learning activities and assessments in one structured platform.",
    url: "/en",
    locale: "en_US",
    alternateLocale: ["fr_FR"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Brivia - Every room becomes part of the answer",
    description: "Run live quizzes, learning activities and assessments in one structured platform.",
    images: ["/opengraph-image"],
  },
};

const FAQ = [
  {
    question: "What is Brivia?",
    answer: "Brivia is an interactive platform for live quizzes, polls, learning activities, courses and assessments. Facilitators create the content, participants join from a browser, and organizations can review the resulting answers and outcomes.",
  },
  {
    question: "Do participants need an account?",
    answer: "No. Participants can join a public live session with a code or QR code without creating an account.",
  },
  {
    question: "Where is application data hosted?",
    answer: "Brivia states that application data is hosted in a European region. The current controls and limitations are documented in the public Trust Center.",
  },
  {
    question: "Can Brivia support an organization-wide deployment?",
    answer: "Yes. Enterprise qualification covers audiences, roles, content governance, integrations, support expectations and security requirements before a proposal is prepared.",
  },
] as const;

const PRODUCT_AREAS = [
  {
    id: "live",
    title: "Participation that starts instantly.",
    text: "Launch quizzes, polls and reactions. The audience joins from a browser and sees the session move in real time.",
    glyph: "live" as const,
  },
  {
    id: "learning",
    title: "Learning that continues after the room.",
    text: "Turn live content into practice, flashcards, courses and structured learning paths without rebuilding the experience elsewhere.",
    glyph: "learning" as const,
  },
  {
    id: "assessment",
    title: "Assessment with a useful next step.",
    text: "Use exams, attempts, thresholds and exports to review understanding and decide what should happen next.",
    glyph: "assessment" as const,
  },
] as const;

export default function EnglishHomePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "en",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
  const pageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Brivia interactive learning platform",
    url: `${SITE_URL}/en`,
    inLanguage: "en",
    about: ["interactive quizzes", "audience engagement", "learning assessment"],
    isPartOf: { "@id": `${SITE_URL}/#software` },
  };

  return (
    <div className="marketing-shell" lang="en">
      <Header />
      <main id="main-content" className={styles.page}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([pageSchema, faqSchema]).replace(/</g, "\\u003c") }} />

        <section className={styles.hero} aria-labelledby="english-home-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Interactive learning platform</p>
            <h1 id="english-home-title">Make every room part of the answer.</h1>
            <p>Run live participation, learning and assessment in one structured experience.</p>
            <div className={styles.heroActions}>
              <a href="/builder-start?type=quiz" data-marketing-cta="en_home_create">
                Create free <ProductGlyph name="arrow" />
              </a>
              <Link href="#product" data-marketing-cta="en_home_product">Explore product</Link>
            </div>
          </div>
          <div className={styles.heroImage}>
            <Image
              src="/images/brivia-reaction-celebration.jpg"
              alt="Three colleagues react together during an interactive Brivia session"
              fill
              priority
              sizes="(max-width: 860px) 100vw, 51vw"
            />
            <div className={styles.imageSignal}>
              <ProductGlyph name="live" />
              <span><small>Live signal</small><strong>The room is responding</strong></span>
            </div>
          </div>
        </section>

        <section className={styles.definition} aria-labelledby="definition-title">
          <span>Brivia, defined</span>
          <div>
            <h2 id="definition-title">What is Brivia?</h2>
            <p>Brivia is an interactive platform for live quizzes, polls, learning activities, courses and assessments. Facilitators create the content, participants join from a browser, and organizations can review the resulting answers and outcomes in one coherent environment.</p>
          </div>
        </section>

        <section id="product" className={styles.productSection} aria-labelledby="product-title">
          <div className={styles.productHeading}>
            <h2 id="product-title">One flow from attention to evidence.</h2>
            <p>Each part works alone. Together, they remove the gaps between a live moment and the learning that follows.</p>
          </div>
          <div className={styles.productAreas}>
            {PRODUCT_AREAS.map((area, index) => (
              <article id={area.id} key={area.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <ProductGlyph name={area.glyph} />
                <h3>{area.title}</h3>
                <p>{area.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.useCases} aria-labelledby="use-cases-title">
          <div className={styles.useCasesLead}>
            <h2 id="use-cases-title">Built for the moment you need.</h2>
          </div>
          <div className={styles.useCaseGrid}>
            <article id="education"><strong>Education</strong><h3>Make understanding visible before the class moves on.</h3><p>Check recall, invite every student to answer and keep practice available after class.</p></article>
            <article id="training"><strong>Training</strong><h3>Connect participation with documented progress.</h3><p>Run workshops, knowledge checks and follow-up activities from the same content base.</p></article>
            <article id="events"><strong>Events</strong><h3>Give a large audience an immediate voice.</h3><p>Collect questions, opinions and reactions without turning participation into technical support.</p></article>
            <article><strong>Organizations</strong><h3>Deploy with governance and trust in view.</h3><p>Frame roles, content, results and security requirements before rollout.</p><Link href="/en/enterprise">Explore Enterprise <ProductGlyph name="arrow" /></Link></article>
          </div>
        </section>

        <section className={styles.trustSection} aria-labelledby="trust-title">
          <div>
            <ProductGlyph name="security" />
            <h2 id="trust-title">Simple for participants. Clear for decision-makers.</h2>
          </div>
          <div className={styles.trustFacts}>
            <p><strong>No participant account</strong><span>Public sessions can be joined with a code or QR code.</span></p>
            <p><strong>European region</strong><span>Application data hosting is documented publicly.</span></p>
            <p><strong>No imaginary certification</strong><span>Current limits remain visible in the Trust Center.</span></p>
            <Link href="/en/security">Open Trust Center <ProductGlyph name="arrow" /></Link>
          </div>
        </section>

        <section className={styles.faqSection} aria-labelledby="english-faq-title">
          <h2 id="english-faq-title">Questions before you start.</h2>
          <div className={styles.faqList}>
            {FAQ.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
          </div>
        </section>

        <section className={styles.closing}>
          <div><h2>See Brivia in your own context.</h2><p>Tell us about your audience, workflow and requirements. We will build the conversation around them.</p></div>
          <Link href="/en/enterprise" data-marketing-cta="en_home_enterprise">Explore Enterprise <ProductGlyph name="arrow" /></Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
