import type { Metadata } from "next";
import { Toaster } from "sonner";
import { SITE_URL } from "@/lib/siteUrl";
import "ui/tokens.css";
import "ui/components.css";
import "./globals.css";

const description = "Quiz multijoueurs, sondages live, flashcards et présentations interactives.";

export const metadata: Metadata = {
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
    locale: "fr_FR",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Brivia — participation, apprentissage et évaluation" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Brivia",
    description,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    <html lang="fr" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
