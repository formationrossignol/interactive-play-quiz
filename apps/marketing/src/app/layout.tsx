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
  openGraph: {
    type: "website",
    siteName: "Brivia",
    title: "Brivia",
    description,
    url: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
