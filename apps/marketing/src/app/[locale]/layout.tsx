import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import { MarketingAnalytics } from "@/components/MarketingAnalytics";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/siteUrl";
import "ui/tokens.css";
import "ui/components.css";
import "../globals.css";

const DESCRIPTIONS = {
  fr: "Quiz multijoueurs, sondages live, flashcards et présentations interactives.",
  en: "Multiplayer quizzes, live polls, flashcards and interactive presentations.",
} as const;

const OG_LOCALES = { fr: "fr_FR", en: "en_US" } as const;

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const description = DESCRIPTIONS[locale as keyof typeof DESCRIPTIONS] ?? DESCRIPTIONS.fr;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: "Brivia", template: "%s | Brivia" },
    description,
    robots: { index: true, follow: true },
    applicationName: "Brivia",
    category: "education",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/favicon.ico" },
    openGraph: {
      type: "website",
      siteName: "Brivia",
      title: "Brivia",
      description,
      url: "/",
      locale: OG_LOCALES[locale as keyof typeof OG_LOCALES] ?? OG_LOCALES.fr,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Brivia — participation, apprentissage et évaluation" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Brivia",
      description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function RootLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const description = DESCRIPTIONS[locale as keyof typeof DESCRIPTIONS] ?? DESCRIPTIONS.fr;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Brivia",
        url: SITE_URL,
        email: "contact@brivia.app",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: "Brivia",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", category: "Starter" },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };

  return (
    <html lang={locale} className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        {/* next-intl's types resolve against the hoisted React 18 copy at the workspace root while this app runs React 19 — same shape at runtime, mismatched nominal type at compile time */}
        <NextIntlClientProvider locale={locale}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {children as any}
        </NextIntlClientProvider>
        <MarketingAnalytics />
        <Toaster />
      </body>
    </html>
  );
}
