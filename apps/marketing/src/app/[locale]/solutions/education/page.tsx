import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthorityPage, type AuthorityChapter } from "@/components/AuthorityPage";
import { getLocalizedAlternates } from "@/lib/pageAlternates";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SolutionsEducationPage" });
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: { canonical: getLocalizedAlternates("/solutions/education").languages[locale], ...getLocalizedAlternates("/solutions/education") },
  };
}

export default async function EducationSolutionPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SolutionsEducationPage" });

  return <AuthorityPage
    language={locale as "fr" | "en"}
    layout={t("layout") as "studio"}
    tone={t("tone") as "blue"}
    eyebrow={t("eyebrow")}
    title={t("title")}
    accent={t("accent")}
    introduction={t("introduction")}
    signal={t("signal")}
    signalDetail={t("signalDetail")}
    facts={t.raw("facts")}
    chapters={t.raw("chapters") as AuthorityChapter[]}
    closingTitle={t("closingTitle")}
    closingText={t("closingText")}
    primaryLabel={t("primaryLabel")}
    primaryHref={t("primaryHref")}
  />;
}
