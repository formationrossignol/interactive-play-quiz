import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Mail, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--ap-font-body)",
  fontWeight: 700,
  fontSize: "14px",
  color: "var(--ap-ink)",
  background: "var(--ap-card)",
  border: "2px solid var(--ap-line)",
  borderRadius: "var(--ap-r-sm)",
  padding: "11px 14px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color .12s, box-shadow .12s",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  fontSize: "11px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: "var(--ap-muted)",
  marginBottom: "7px",
  fontFamily: "var(--ap-font-body)",
};

const Contact = () => {
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Message envoyé ! Nous vous répondrons rapidement.");
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-brand)";
    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-line)";
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--ap-paper)" }}>
      <Header />

      <main style={{ flex: 1 }}>
        <div className="mx-auto max-w-4xl px-6 py-16">

          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <span className="ap-badge ap-badge--brand" style={{ marginBottom: "20px", display: "inline-flex" }}>
              Contact
            </span>
            <h1 className="ap-h1" style={{ fontSize: "clamp(32px,5vw,48px)", marginBottom: "16px" }}>
              Contactez-nous
            </h1>
            <p className="ap-lead">
              Une question ? Une suggestion ? Nous sommes là pour vous aider.
            </p>
          </div>

          {/* Contact cards */}
          <div style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", marginBottom: "32px" }}>
            {/* Email */}
            <div className="ap-card" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div
                className="ap-tile__icon"
                style={{ background: "var(--ap-brand)", boxShadow: "0 5px 0 var(--ap-brand-deep)" }}
              >
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
                style={{ color: "var(--ap-brand)", fontWeight: 800, fontSize: "14px", textDecoration: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
              >
                contact@quizmaster.com
              </a>
            </div>

            {/* Support */}
            <div className="ap-card" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div
                className="ap-tile__icon"
                style={{ background: "var(--ap-pres)", boxShadow: "0 5px 0 var(--ap-pres-deep)" }}
              >
                <MessageSquare className="h-6 w-6" color="#fff" />
              </div>
              <div>
                <h3 className="ap-h3">Support</h3>
                <p className="ap-muted" style={{ fontSize: "13px", marginTop: "4px" }}>
                  Consultez notre centre d'aide pour des réponses rapides
                </p>
              </div>
              <a
                href="#faq"
                className="ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill"
                style={{ alignSelf: "flex-start", textDecoration: "none" }}
              >
                Centre d'aide
              </a>
            </div>
          </div>

          {/* Form */}
          <div className="ap-card ap-card--floaty" style={{ padding: "36px 40px" }}>
            <h2 className="ap-h3" style={{ marginBottom: "6px" }}>Envoyez-nous un message</h2>
            <p className="ap-muted" style={{ fontSize: "14px", marginBottom: "28px" }}>
              Remplissez le formulaire ci-dessous et nous vous répondrons dans les plus brefs délais.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label style={labelStyle}>Nom</label>
                  <input
                    style={inputStyle}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Votre nom"
                    required
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    style={inputStyle}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="votre@email.com"
                    required
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Sujet</label>
                <input
                  style={inputStyle}
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="De quoi souhaitez-vous parler ?"
                  required
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>

              <div>
                <label style={labelStyle}>Message</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: "140px", lineHeight: 1.5 }}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Décrivez votre demande…"
                  rows={6}
                  required
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>

              <button type="submit" className="ap-btn ap-btn--pill" style={{ width: "100%", gap: "8px" }}>
                <Send className="w-4 h-4" />
                Envoyer le message
              </button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
