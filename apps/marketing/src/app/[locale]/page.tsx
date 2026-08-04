import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { IndexMain, type IndexMainCopy } from "@/components/IndexMain";
import type { HeroMiniQuizContent } from "@/components/HeroMiniQuiz";
import type { SignatureProductSceneContent } from "@/components/SignatureProductScene";
import type { CompetitorComparisonContent } from "@/components/landing/CompetitorComparison";
import { fetchReviews } from "@/lib/repo";
import { SITE_URL } from "@/lib/siteUrl";
import { fetchPartners } from "@/lib/siteSettings";
import { getLocalizedAlternates } from "@/lib/pageAlternates";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "HomePage" });

  if (locale === "en") {
    return {
      title: t("meta.title"),
      description: t("meta.description"),
      alternates: { canonical: "/en", ...getLocalizedAlternates("/") },
      openGraph: {
        title: t("ogTitle"),
        description: t("ogDescription"),
        url: "/en",
        locale: "en_US",
        alternateLocale: ["fr_FR"],
      },
      twitter: {
        card: "summary_large_image",
        title: t("ogTitle"),
        description: t("ogDescription"),
        images: ["/opengraph-image"],
      },
    };
  }

  // Mirrors the default (path: "/", no title/description override) case of
  // apps/app/src/hooks/useSEO.ts + apps/app/src/lib/seo.ts's DEFAULT_TITLE/
  // DEFAULT_DESCRIPTION.
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: { canonical: "/", ...getLocalizedAlternates("/") },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const english = locale === "en";
  const [reviews, partners] = await Promise.all([fetchReviews(), fetchPartners()]);
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length).toFixed(1)
    : null;

  const home = await getTranslations({ locale, namespace: "HomePage" });
  const t = await getTranslations({ locale, namespace: "IndexMain" });
  const partnersT = await getTranslations({ locale, namespace: "PartnersStrip" });
  const quizT = await getTranslations({ locale, namespace: "HeroMiniQuiz" });
  const sceneT = await getTranslations({ locale, namespace: "SignatureProductScene" });
  const comparisonT = await getTranslations({ locale, namespace: "CompetitorComparison" });

  const copy: IndexMainCopy = {
    invalidCode: t("invalidCode"),
    heroTitle: t("heroTitle"),
    heroAccent: t("heroAccent"),
    heroText: t("heroText"),
    create: t("create"),
    demo: t("demo"),
    heroAlt: t("heroAlt"),
    activeSession: t("activeSession"),
    collectiveSignal: t("collectiveSignal"),
    mediaTitle: t("mediaTitle"),
    mediaText: t("mediaText"),
    proofTitle: t("proofTitle"),
    proofText: t("proofText"),
    proofNav: t("proofNav"),
    references: t("references"),
    trust: t("trust"),
    trustDetail: t("trustDetail"),
    demoTitle: t("demoTitle"),
    demoText: t("demoText"),
    formatsTitle: t("formatsTitle"),
    formatsText: t("formatsText"),
    formatsNav: t("formatsNav"),
    featuresLink: t("featuresLink"),
    audienceTitle: t("audienceTitle"),
    audienceText: t("audienceText"),
    educatorTitle: t("educatorTitle"),
    educatorText: t("educatorText"),
    educatorLink: t("educatorLink"),
    organizationTitle: t("organizationTitle"),
    organizationText: t("organizationText"),
    organizationLink: t("organizationLink"),
    questionTitle: t("questionTitle"),
    questionText: t("questionText"),
    questionAlt: t("questionAlt"),
    questionNav: t("questionNav"),
    questionLink: t("questionLink"),
    comparisonTitle: t("comparisonTitle"),
    comparisonText: t("comparisonText"),
    comparisonLink: t("comparisonLink"),
    reviewsTitle: t("reviewsTitle"),
    reviewsAlt: t("reviewsAlt"),
    emptyReviews: t("emptyReviews"),
    reviewLink: t("reviewLink"),
    faqTitle: t("faqTitle"),
    helpLink: t("helpLink"),
    trustTitle: t("trustTitle"),
    trustFacts: t.raw("trustFacts") as [string, string, string],
    trustLink: t("trustLink"),
    joinTitle: t("joinTitle"),
    joinText: t("joinText"),
    codeLabel: t("codeLabel"),
    join: t("join"),
    codeHelp: t("codeHelp"),
    examLink: t("examLink"),
    finalCta: t("finalCta"),
    pricing: t("pricing"),
    reviewsCountText: reviews.length > 0
      ? (english ? `${reviews.length} reviews` : `${reviews.length} avis`)
      : (english ? "Reviews" : "Avis"),
    ratingValueText: avgRating
      ? `${avgRating}/5 ${english ? "published" : "publié"}`
      : (english ? "No invented average" : "Aucune moyenne inventée"),
    referencesCountText: partners.length > 0
      ? (english ? `${partners.length} approved` : `${partners.length} autorisée${partners.length > 1 ? "s" : ""}`)
      : (english ? "Public protocol" : "Protocole public"),
    ratingSummaryText: avgRating
      ? (english ? `${avgRating}/5 from ${reviews.length} published reviews` : `${avgRating}/5 sur ${reviews.length} retours publiés`)
      : null,
  };

  const heroQuiz: HeroMiniQuizContent = {
    ariaLabel: quizT("ariaLabel"),
    defaultHint: quizT("defaultHint"),
    almostHint: quizT("almostHint"),
    timeUpHint: quizT("timeUpHint"),
    finalScore: quizT("finalScore"),
    playAgain: quizT("playAgain"),
    questions: quizT.raw("questions"),
  };

  const signatureScene: SignatureProductSceneContent = {
    eyebrow: sceneT("eyebrow"),
    titleStart: sceneT("titleStart"),
    titleAccent: sceneT("titleAccent"),
    intro: sceneT("intro"),
    introBadge: sceneT("introBadge"),
    stepsAriaLabel: sceneT("stepsAriaLabel"),
    activeFlow: sceneT("activeFlow"),
    resume: sceneT("resume"),
    pause: sceneT("pause"),
    brandName: sceneT("brandName"),
    activeSessionLabel: sceneT("activeSessionLabel"),
    workshopMeta: sceneT("workshopMeta"),
    stages: sceneT.raw("stages"),
    compose: sceneT.raw("compose"),
    join: sceneT.raw("join"),
    respond: sceneT.raw("respond"),
    understand: sceneT.raw("understand"),
  };

  const competitorComparison: CompetitorComparisonContent = {
    ariaLabel: comparisonT("ariaLabel"),
    featuresHeader: comparisonT("featuresHeader"),
    legendAriaLabel: comparisonT("legendAriaLabel"),
    legendIncluded: comparisonT("legendIncluded"),
    legendPartial: comparisonT("legendPartial"),
    legendAbsent: comparisonT("legendAbsent"),
    disclaimerIntro: comparisonT("disclaimerIntro"),
    disclaimerAnd: comparisonT("disclaimerAnd"),
    disclaimerReports: comparisonT("disclaimerReports"),
    disclaimerAnd2: comparisonT("disclaimerAnd2"),
    products: comparisonT.raw("products"),
    rows: comparisonT.raw("rows"),
  };

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
      mainEntity: (home.raw("faq") as { question: string; answer: string }[]).map((item) => ({
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
      <IndexMain
        reviews={reviews}
        avgRating={avgRating}
        partners={partners}
        locale={english ? "en" : "fr"}
        copy={copy}
        formats={t.raw("formats")}
        faq={t.raw("faq")}
        questionLabels={t.raw("questionLabels")}
        partnersMessage={partnersT("message")}
        heroQuiz={heroQuiz}
        signatureScene={signatureScene}
        competitorComparison={competitorComparison}
      />
      <Footer />
    </div>
  );
}
