import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { IndexMain } from "@/components/IndexMain";
import { fetchReviews } from "@/lib/repo";
import { SITE_URL } from "@/lib/siteUrl";
import { fetchPartners } from "@/lib/siteSettings";

export const metadata: Metadata = {
  title: "Interactive quizzes, learning and assessment",
  description: "Brivia brings live participation, learning activities and assessment into one interactive platform for educators, trainers and organizations.",
  alternates: {
    canonical: "/en",
    languages: { fr: "/", en: "/en", "x-default": "/" },
  },
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

const FAQ = [
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

export default async function EnglishHomePage() {
  const [reviews, partners] = await Promise.all([fetchReviews(), fetchPartners()]);
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length).toFixed(1)
    : null;
  const structuredData = [
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
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];

  return (
    <div className="marketing-shell" lang="en">
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <IndexMain language="en" reviews={reviews} avgRating={avgRating} partners={partners} />
      <Footer />
    </div>
  );
}
