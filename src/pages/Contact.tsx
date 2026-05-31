import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChevronDown, ChevronUp, HelpCircle, Mail, MessageSquare, Send } from "lucide-react";
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

const FAQ_ITEMS = [
  {
    category: "Démarrage",
    questions: [
      {
        q: "Comment créer mon premier quiz ?",
        a: "Cliquez sur « Créer gratuitement » depuis l'accueil, choisissez le type de contenu (Quiz, Sondage, Flashcard ou Présentation), puis construisez vos questions. Vous pouvez aussi partir d'un modèle prêt à l'emploi.",
      },
      {
        q: "Faut-il un compte pour utiliser l'application ?",
        a: "Vous pouvez créer et lancer du contenu sans compte, mais un compte permet de sauvegarder vos créations, d'accéder à vos statistiques et de retrouver vos résultats depuis n'importe quel appareil.",
      },
      {
        q: "L'application est-elle gratuite ?",
        a: "Oui, les fonctionnalités essentielles sont entièrement gratuites. Des options avancées (personnalisation avancée, export, analytics détaillées) sont disponibles dans les plans supérieurs.",
      },
    ],
  },
  {
    category: "Quiz & Sondages en direct",
    questions: [
      {
        q: "Comment les participants rejoignent-ils une session ?",
        a: "Partagez le code à 6 chiffres affiché à l'écran, ou le lien QR Code généré automatiquement. Les participants ouvrent l'application sur leur smartphone et saisissent le code — aucune inscription requise.",
      },
      {
        q: "Combien de participants peut-on accueillir simultanément ?",
        a: "Il n'y a pas de limite stricte côté application. En pratique, les sessions fonctionnent très bien jusqu'à plusieurs centaines de participants. La synchronisation repose sur Supabase Realtime.",
      },
      {
        q: "Les réponses des sondages sont-elles sauvegardées ?",
        a: "Oui. Dès que vous lancez un sondage, les réponses des participants sont collectées en temps réel et accessibles dans la page « Résultats » du sondage, avec des graphiques par question.",
      },
      {
        q: "Peut-on relancer un même quiz plusieurs fois ?",
        a: "Absolument. Depuis « Mes Quiz », cliquez sur « Lancer » — chaque lancement crée une nouvelle session avec un code unique. Les sessions précédentes restent dans l'historique.",
      },
    ],
  },
  {
    category: "Flashcards & Présentations",
    questions: [
      {
        q: "Comment fonctionne le mode Flashcard ?",
        a: "Les flashcards s'affichent une par une en mode révision : recto (question ou terme) puis verso (réponse ou définition). Idéal pour mémoriser du vocabulaire, des formules ou des concepts clés.",
      },
      {
        q: "Puis-je insérer des images dans mes slides ?",
        a: "Oui, chaque diapositive et chaque question peut inclure une image (URL ou upload). Les images sont affichées en pleine largeur dans le mode présentation.",
      },
    ],
  },
  {
    category: "Données & Confidentialité",
    questions: [
      {
        q: "Où sont stockées mes données ?",
        a: "Les contenus créés sont stockés localement dans votre navigateur (localStorage) et, lorsqu'un compte est actif, synchronisés via Supabase (hébergé en Europe). Aucune donnée n'est vendue à des tiers.",
      },
      {
        q: "Comment supprimer mes créations ?",
        a: "Dans les pages « Mes Quiz », « Mes Sondages » ou « Mes Flashcards », cliquez sur l'icône corbeille de la carte concernée, puis confirmez la suppression.",
      },
    ],
  },
];

const FAQItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "2px solid var(--ap-line)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 0", background: "none", border: "none", cursor: "pointer",
          textAlign: "left", gap: "12px",
        }}
      >
        <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: "15px", color: "var(--ap-ink)", flex: 1 }}>
          {q}
        </span>
        {open
          ? <ChevronUp style={{ width: 18, height: 18, color: "var(--ap-brand)", flexShrink: 0 }} />
          : <ChevronDown style={{ width: 18, height: 18, color: "var(--ap-muted)", flexShrink: 0 }} />
        }
      </button>
      {open && (
        <p style={{ fontFamily: "var(--ap-font-body)", fontWeight: 600, fontSize: "14px", lineHeight: 1.6, color: "var(--ap-muted)", paddingBottom: "16px", margin: 0 }}>
          {a}
        </p>
      )}
    </div>
  );
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

          {/* FAQ */}
          <div id="faq" style={{ marginBottom: "40px", scrollMarginTop: "80px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
              <div className="ap-tile__icon" style={{ background: "var(--ap-brand)", boxShadow: "0 5px 0 var(--ap-brand-deep)", flexShrink: 0 }}>
                <HelpCircle className="h-6 w-6" color="#fff" />
              </div>
              <div>
                <h2 className="ap-h2" style={{ fontSize: "22px", marginBottom: "2px" }}>Centre d'aide</h2>
                <p className="ap-muted" style={{ fontSize: "13px" }}>Réponses aux questions les plus fréquentes</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              {FAQ_ITEMS.map((section) => (
                <div key={section.category} className="ap-card" style={{ padding: "24px 28px" }}>
                  <h3 style={{ fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: "11px", letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--ap-brand)", marginBottom: "4px" }}>
                    {section.category}
                  </h3>
                  {section.questions.map((item) => (
                    <FAQItem key={item.q} q={item.q} a={item.a} />
                  ))}
                </div>
              ))}
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
