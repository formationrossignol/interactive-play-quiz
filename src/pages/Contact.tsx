import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Mail, MessageSquare, Send, Clock } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";

const COOLDOWN_SECONDS = 60;
const MAX_PER_HOUR = 3;
const STORAGE_KEY = "contact_flood";

interface FloodState {
  lastSubmit: number;
  submits: number[];
}

function loadFlood(): FloodState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { lastSubmit: 0, submits: [] };
  } catch {
    return { lastSubmit: 0, submits: [] };
  }
}

function saveFlood(state: FloodState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

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
  const navigate = useNavigate();
  useSEO({
    title: "Contact",
    description: "Contactez l'équipe Ludiq pour toute question sur nos quiz interactifs, sondages live et outils de formation. Réponse sous 24h.",
    path: "/contact",
  });
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [honeypot, setHoneypot] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [hourlyBlocked, setHourlyBlocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const flood = loadFlood();
    const now = Date.now();
    const elapsed = Math.floor((now - flood.lastSubmit) / 1000);
    const remaining = COOLDOWN_SECONDS - elapsed;
    if (remaining > 0) setCooldown(remaining);

    const recentSubmits = flood.submits.filter(t => now - t < 3600_000);
    if (recentSubmits.length >= MAX_PER_HOUR) setHourlyBlocked(true);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cooldown]);

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-brand)";
    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-line)";
    e.currentTarget.style.boxShadow = "none";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot: bot filled the hidden field
    if (honeypot) {
      toast.success("Message envoyé ! Nous vous répondrons rapidement.");
      setFormData({ name: "", email: "", subject: "", message: "" });
      return;
    }

    // Anti-flood: cooldown
    if (cooldown > 0) {
      toast.error(`Veuillez attendre ${cooldown}s avant de renvoyer un message.`);
      return;
    }

    // Anti-flood: hourly limit
    const flood = loadFlood();
    const now = Date.now();
    const recentSubmits = flood.submits.filter(t => now - t < 3600_000);
    if (recentSubmits.length >= MAX_PER_HOUR) {
      setHourlyBlocked(true);
      toast.error("Limite horaire atteinte. Réessayez dans une heure.");
      return;
    }

    // Anti-spam: minimum message length
    if (formData.message.trim().length < 20) {
      toast.error("Votre message est trop court (20 caractères minimum).");
      return;
    }

    // Anti-spam: no URL-only or repeated-char messages
    const msg = formData.message.trim();
    const urlOnly = /^https?:\/\/\S+$/.test(msg);
    const repeatedChar = /^(.)\1{9,}$/.test(msg.replace(/\s/g, ""));
    if (urlOnly || repeatedChar) {
      toast.error("Contenu non valide.");
      return;
    }

    // Record submission
    const newFlood: FloodState = {
      lastSubmit: now,
      submits: [...recentSubmits, now],
    };
    saveFlood(newFlood);
    setCooldown(COOLDOWN_SECONDS);

    toast.success("Message envoyé ! Nous vous répondrons rapidement.");
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  const isBlocked = cooldown > 0 || hourlyBlocked;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
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
                style={{ color: "var(--ap-brand)", fontWeight: 800, fontSize: "14px", textDecoration: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
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
                  Consultez notre centre d'aide pour des réponses rapides
                </p>
              </div>
              <button
                onClick={() => navigate("/help")}
                className="ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill"
                style={{ alignSelf: "flex-start" }}
              >
                Centre d'aide
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="ap-card ap-card--floaty" style={{ padding: "36px 40px" }}>
            <h2 className="ap-h3" style={{ marginBottom: "6px" }}>Envoyez-nous un message</h2>
            <p className="ap-muted" style={{ fontSize: "14px", marginBottom: "28px" }}>
              Remplissez le formulaire ci-dessous et nous vous répondrons dans les plus brefs délais.
            </p>

            {hourlyBlocked ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "32px 0", textAlign: "center" }}>
                <Clock style={{ width: 40, height: 40, color: "var(--ap-muted)" }} />
                <p className="ap-muted" style={{ fontWeight: 700 }}>Limite horaire atteinte ({MAX_PER_HOUR} messages/heure).</p>
                <p className="ap-muted" style={{ fontSize: "13px" }}>Réessayez dans une heure ou écrivez-nous directement par email.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Honeypot — hidden from users, filled by bots */}
                <div style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }} aria-hidden>
                  <label>Ne pas remplir</label>
                  <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </div>

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
                    placeholder="Décrivez votre demande… (20 caractères minimum)"
                    rows={6}
                    required
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </div>

                <button
                  type="submit"
                  className="ap-btn ap-btn--pill"
                  style={{ width: "100%", gap: "8px", opacity: isBlocked ? 0.5 : 1, cursor: isBlocked ? "not-allowed" : "pointer" }}
                  disabled={isBlocked}
                >
                  {cooldown > 0 ? (
                    <><Clock className="w-4 h-4" />Patienter {cooldown}s</>
                  ) : (
                    <><Send className="w-4 h-4" />Envoyer le message</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
