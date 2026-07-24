import type { Metadata } from "next";
import { HelpCircle, Mail } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FaqAccordionItem } from "@/components/FaqAccordion";
import { fetchFaq } from "@/lib/repo";

export const metadata: Metadata = {
  title: "Centre d'aide",
  description: "FAQ et guides pour créer vos premiers quiz, lancer une session en direct, gérer vos participants et exporter vos résultats sur Brivia.",
};

export default async function HelpPage() {
  const faq = await fetchFaq();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />

      <main style={{ flex: 1 }}>
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h1 className="ap-h1" style={{ fontSize: "clamp(32px,5vw,48px)", marginBottom: "16px" }}>
              Comment pouvons-nous vous aider ?
            </h1>
            <p className="ap-lead">
              Retrouvez les réponses aux questions les plus fréquentes ci-dessous.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "48px" }}>
            {faq.length === 0 ? (
              <p className="ap-muted" style={{ textAlign: "center" }}>Aucune question pour le moment.</p>
            ) : (
              faq.map((section) => (
                <div key={section.category} className="ap-card" style={{ padding: "24px 28px" }}>
                  <h2 style={{ fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: "11px", letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--ap-brand)", marginBottom: "4px" }}>
                    {section.category}
                  </h2>
                  {section.questions.map((item) => (
                    <FaqAccordionItem key={item.q} q={item.q} a={item.a} />
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="ap-card ap-card--floaty" style={{ padding: "36px", textAlign: "center" }}>
            <div className="ap-tile__icon" style={{ background: "var(--ap-brand)", boxShadow: "0 5px 0 var(--ap-brand-deep)", margin: "0 auto 16px" }}>
              <HelpCircle className="h-6 w-6" color="#fff" />
            </div>
            <h3 className="ap-h3" style={{ marginBottom: "8px" }}>Vous n&apos;avez pas trouvé votre réponse ?</h3>
            <p className="ap-muted" style={{ fontSize: "14px", marginBottom: "20px" }}>
              Notre équipe est là pour vous aider. Envoyez-nous un message.
            </p>
            <a className="ap-btn ap-btn--pill" href="/contact" style={{ gap: "8px" }}>
              <Mail className="w-4 h-4" />
              Nous contacter
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
