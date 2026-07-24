import type { Metadata } from "next";
import { Mail, MessageSquare } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez l'équipe Brivia pour toute question sur nos quiz interactifs, sondages live et outils de formation. Réponse sous 24h.",
};

export default function ContactPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />

      <main style={{ flex: 1 }}>
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h1 className="ap-h1" style={{ fontSize: "clamp(32px,5vw,48px)", marginBottom: "16px" }}>
              Contactez-nous
            </h1>
            <p className="ap-lead">
              Une question ? Une suggestion ? Nous sommes là pour vous aider.
            </p>
          </div>

          <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", marginBottom: "32px" }}>
            <div className="ap-card" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="ap-tile__icon" style={{ background: "var(--ap-brand)", boxShadow: "0 5px 0 var(--ap-brand-deep)" }}>
                <Mail className="h-6 w-6" color="#fff" />
              </div>
              <div>
                <h3 className="ap-h3">Email</h3>
                <p className="ap-muted" style={{ fontSize: "13px", marginTop: "4px" }}>
                  Écrivez-nous directement à notre adresse email
                </p>
              </div>
              <a
                href="mailto:contact@quizmaster.com"
                style={{ color: "var(--ap-brand)", fontWeight: 800, fontSize: "14px" }}
              >
                contact@quizmaster.com
              </a>
            </div>

            <div className="ap-card" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="ap-tile__icon" style={{ background: "var(--ap-pres)", boxShadow: "0 5px 0 var(--ap-pres-deep)" }}>
                <MessageSquare className="h-6 w-6" color="#fff" />
              </div>
              <div>
                <h3 className="ap-h3">Support</h3>
                <p className="ap-muted" style={{ fontSize: "13px", marginTop: "4px" }}>
                  Consultez notre centre d&apos;aide pour des réponses rapides
                </p>
              </div>
              <a
                href="/help"
                className="ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill"
                style={{ alignSelf: "flex-start" }}
              >
                Centre d&apos;aide
              </a>
            </div>
          </div>

          <div className="ap-card ap-card--floaty" style={{ padding: "36px 40px" }}>
            <h2 className="ap-h3" style={{ marginBottom: "6px" }}>Envoyez-nous un message</h2>
            <p className="ap-muted" style={{ fontSize: "14px", marginBottom: "28px" }}>
              Remplissez le formulaire ci-dessous et nous vous répondrons dans les plus brefs délais.
            </p>
            <ContactForm />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
