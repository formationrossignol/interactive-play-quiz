import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HelpExplorer } from "@/components/HelpExplorer";
import { fetchFaq } from "@/lib/repo";
import styles from "@/components/ResourcePages.module.css";

export const metadata: Metadata = {
  title: "Centre d’aide",
  description: "Aide pour créer, lancer et analyser vos quiz, sondages, examens, cours et présentations Brivia.",
  alternates: { canonical: "/help" },
};

export function generateStaticParams() {
  return [{ locale: "fr" }];
}

type Props = { params: Promise<{ locale: string }> };

export default async function HelpPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "fr") notFound();

  const faq = await fetchFaq();
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.flatMap((group) => group.questions).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return <div className="marketing-shell">
    <Header />
    <main id="main-content" className={`${styles.resourcePage} ${styles.helpPage}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} />
      <section className={styles.helpHero} aria-labelledby="help-title">
        <p className={styles.eyebrow}>Centre d’aide Brivia</p>
        <h1 id="help-title">Trouvez la réponse. <span>Reprenez votre session.</span></h1>
        <p>Décrivez ce que vous cherchez ou parcourez les réponses selon l’étape de votre travail.</p>
      </section>
      <HelpExplorer groups={faq} />
    </main>
    <Footer />
  </div>;
}
