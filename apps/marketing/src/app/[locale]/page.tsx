import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { IndexMain } from "@/components/IndexMain";
import { fetchReviews } from "@/lib/repo";
import { SITE_URL } from "@/lib/siteUrl";
import { fetchPartners } from "@/lib/siteSettings";

type Props = { params: Promise<{ locale: string }> };

const ENGLISH_FAQ = [
  {
    question: "Is Brivia really free to start?",
    answer: "Yes. The Starter plan lets you create up to 5 pieces of content and welcome 20 participants per session, with no time limit.",
  },
  {
    question: "Do participants need to create an account?",
    answer: "No. They join with a six-character code or QR code directly from their browser.",
  },
  {
    question: "Where is the data hosted?",
    answer: "Application data is hosted in a European region, as documented in the Trust Center.",
  },
  {
    question: "Can I export the results?",
    answer: "Yes, from the Pro plan. Detailed reports can be exported for further analysis.",
  },
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  if (locale === "en") {
    return {
      title: "Interactive quizzes, learning and assessment",
      description: "Brivia brings live participation, learning activities and assessment into one interactive platform for educators, trainers and organizations.",
      alternates: { canonical: "/en", languages: { fr: "/", en: "/en", "x-default": "/" } },
      openGraph: {
        title: "Brivia - From live participation to results",
        description: "Run live quizzes, learning activities and assessments in one structured platform.",
        url: "/en",
        locale: "en_US",
        alternateLocale: ["fr_FR"],
      },
      twitter: {
        card: "summary_large_image",
        title: "Brivia - From live participation to results",
        description: "Run live quizzes, learning activities and assessments in one structured platform.",
        images: ["/opengraph-image"],
      },
    };
  }

  // Mirrors the default (path: "/", no title/description override) case of
  // apps/app/src/hooks/useSEO.ts + apps/app/src/lib/seo.ts's DEFAULT_TITLE/
  // DEFAULT_DESCRIPTION.
  return {
    title: "Brivia - Quiz et sondages interactifs en temps réel",
    description: "Créez des quiz multijoueurs, sondages live et présentations interactives. QR code, classement instantané et ambiance arcade, sans rien sacrifier en puissance.",
    alternates: { canonical: "/", languages: { fr: "/", en: "/en", "x-default": "/" } },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const english = locale === "en";
  const [reviews, partners] = await Promise.all([fetchReviews(), fetchPartners()]);
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length).toFixed(1)
    : null;

  const structuredData = english ? [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Brivia interactive learning platform",
      url: `${SITE_URL}/en`,
      inLanguage: "en",
      about: ["interactive quizzes", "audience engagement", "learning assessment"],
      isPartOf: { "@id": `${SITE_URL}/#software` },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: "en",
      mainEntity: ENGLISH_FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ] : null;

  return (
    <div className="marketing-shell">
      <Header />
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      )}
      <IndexMain language={english ? "en" : "fr"} reviews={reviews} avgRating={avgRating} partners={partners} />
      <Footer />
    </div>
  );
}
