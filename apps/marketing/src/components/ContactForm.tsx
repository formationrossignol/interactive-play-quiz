"use client";

import { useState, useEffect, useRef } from "react";
import { Clock, Send } from "lucide-react";
import { toast } from "sonner";
import styles from "./ContactForm.module.css";

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
  border: "var(--ap-border-w) solid var(--ap-line)",
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

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organization: "",
    role: "",
    requestType: "demo",
    teamSize: "",
    message: "",
  });
  const [honeypot, setHoneypot] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [hourlyBlocked, setHourlyBlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Reading localStorage (an external system, unavailable during SSR) once
    // on mount — this is React's documented SSR-safe pattern (render the
    // neutral default first, correct after mount) to avoid a hydration
    // mismatch. Not the "derived state" case react-hooks/set-state-in-effect
    // is meant to catch.
    const flood = loadFlood();
    const now = Date.now();
    const elapsed = Math.floor((now - flood.lastSubmit) / 1000);
    const remaining = COOLDOWN_SECONDS - elapsed;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (remaining > 0) setCooldown(remaining);

    const recentSubmits = flood.submits.filter((t) => now - t < 3600_000);
    if (recentSubmits.length >= MAX_PER_HOUR) setHourlyBlocked(true);

    const intent = new URLSearchParams(window.location.search).get("intent");
    const supportedIntent = ["demo", "enterprise", "education", "event", "support", "other"].includes(intent ?? "")
      ? intent as string
      : intent === "training" || intent === "integration" || intent === "security" || intent === "pilot"
        ? "enterprise"
        : intent === "accessibility" ? "support" : null;
    if (supportedIntent) {
      setFormData((current) => ({ ...current, requestType: supportedIntent }));
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cooldown]);

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-brand)";
    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-line)";
    e.currentTarget.style.boxShadow = "none";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (honeypot) {
      toast.success("Message envoyé. Nous vous répondrons rapidement.");
      return;
    }

    if (cooldown > 0) {
      toast.error(`Veuillez attendre ${cooldown}s avant de renvoyer un message.`);
      return;
    }

    const flood = loadFlood();
    const now = Date.now();
    const recentSubmits = flood.submits.filter((t) => now - t < 3600_000);
    if (recentSubmits.length >= MAX_PER_HOUR) {
      setHourlyBlocked(true);
      toast.error("Limite horaire atteinte. Réessayez dans une heure.");
      return;
    }

    if (formData.message.trim().length < 20) {
      toast.error("Votre message est trop court (20 caractères minimum).");
      return;
    }

    const msg = formData.message.trim();
    const urlOnly = /^https?:\/\/\S+$/.test(msg);
    const repeatedChar = /^(.)\1{9,}$/.test(msg.replace(/\s/g, ""));
    if (urlOnly || repeatedChar) {
      toast.error("Contenu non valide.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...formData,
          website: honeypot,
          sourcePath: `${window.location.pathname}${window.location.search}`,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Le message n’a pas pu être transmis.");

      saveFlood({ lastSubmit: now, submits: [...recentSubmits, now] });
      setCooldown(COOLDOWN_SECONDS);
      toast.success("Message transmis. Notre équipe revient vers vous rapidement.");
      setFormData({ name: "", email: "", organization: "", role: "", requestType: "demo", teamSize: "", message: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Le message n’a pas pu être transmis.");
    } finally {
      setSubmitting(false);
    }
  };

  const isBlocked = cooldown > 0 || hourlyBlocked || submitting;

  if (hourlyBlocked) {
    return (
      <div className={styles.blocked}>
        <Clock style={{ width: 40, height: 40, color: "var(--ap-muted)" }} />
        <p className="ap-muted" style={{ fontWeight: 700 }}>Limite horaire atteinte ({MAX_PER_HOUR} messages/heure).</p>
        <p className="ap-muted" style={{ fontSize: "13px" }}>Réessayez dans une heure ou écrivez-nous directement par email.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.hidden} aria-hidden>
        <label htmlFor="contact-website">Ne pas remplir</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>

      <div className={styles.identityGrid}>
        <div>
          <label htmlFor="contact-name" style={labelStyle}>Nom</label>
          <input
            id="contact-name"
            style={inputStyle}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Votre nom"
            required
            onFocus={onFocus} onBlur={onBlur}
          />
        </div>
        <div>
          <label htmlFor="contact-email" style={labelStyle}>Email</label>
          <input
            id="contact-email"
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

      <div className={styles.identityGrid}>
        <div>
          <label htmlFor="contact-organization" style={labelStyle}>Organisation</label>
          <input
            id="contact-organization"
            style={inputStyle}
            value={formData.organization}
            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
            placeholder="École, entreprise, organisme…"
            onFocus={onFocus} onBlur={onBlur}
          />
        </div>
        <div>
          <label htmlFor="contact-role" style={labelStyle}>Votre rôle</label>
          <input
            id="contact-role"
            style={inputStyle}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            placeholder="Formation, RH, enseignement…"
            onFocus={onFocus} onBlur={onBlur}
          />
        </div>
      </div>

      <div className={styles.identityGrid}>
        <div>
          <label htmlFor="contact-type" style={labelStyle}>Votre projet</label>
          <select
            id="contact-type"
            style={inputStyle}
            value={formData.requestType}
            onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
            onFocus={onFocus} onBlur={onBlur}
          >
            <option value="demo">Réserver une démonstration</option>
            <option value="enterprise">Déploiement organisation</option>
            <option value="education">Éducation</option>
            <option value="event">Événement</option>
            <option value="support">Support produit</option>
            <option value="other">Autre demande</option>
          </select>
        </div>
        <div>
          <label htmlFor="contact-team-size" style={labelStyle}>Audience envisagée</label>
          <select
            id="contact-team-size"
            style={inputStyle}
            value={formData.teamSize}
            onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
            onFocus={onFocus} onBlur={onBlur}
          >
            <option value="">À préciser</option>
            <option value="1-20">1 à 20 personnes</option>
            <option value="21-200">21 à 200 personnes</option>
            <option value="201-1000">201 à 1 000 personnes</option>
            <option value="1000+">Plus de 1 000 personnes</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" style={labelStyle}>Message</label>
        <textarea
          id="contact-message"
          style={{ ...inputStyle, resize: "vertical", minHeight: "140px", lineHeight: 1.5 }}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          placeholder="Contexte, objectifs, calendrier, contraintes techniques…"
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
        {submitting ? (
          <><span className={styles.spinner} aria-hidden="true" />Transmission…</>
        ) : cooldown > 0 ? (
          <><Clock className="w-4 h-4" />Patienter {cooldown}s</>
        ) : (
          <><Send className="w-4 h-4" />Envoyer le message</>
        )}
      </button>
    </form>
  );
}
