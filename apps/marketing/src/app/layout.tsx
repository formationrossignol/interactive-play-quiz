import type { Metadata } from "next";
import { Toaster } from "sonner";
import "ui/tokens.css";
import "ui/components.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Brivia", template: "%s | Brivia" },
  description: "Quiz multijoueurs, sondages live, flashcards et présentations interactives.",
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
