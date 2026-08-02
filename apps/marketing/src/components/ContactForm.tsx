"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { trackMarketingEvent } from "@/lib/marketingAnalytics";
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

function ClockGlyph({ large = false }: { large?: boolean }) {
  return (
    <svg className={large ? styles.statusGlyph : styles.buttonGlyph} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3.2 2" />
    </svg>
  );
}

function SendGlyph() {
  return (
    <svg className={styles.buttonGlyph} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 5 16 7-16 7 2.5-7L4 5Z" /><path d="M6.5 12H20" />
    </svg>
  );
}

const COPY = {
  fr: {
    sent: "Message envoyé. Nous vous répondrons rapidement.", wait: (seconds: number) => `Veuillez attendre ${seconds}s avant de renvoyer un message.`,
    hourly: "Limite horaire atteinte. Réessayez dans une heure.", short: "Votre message est trop court (20 caractères minimum).", invalid: "Contenu non valide.",
    transmissionError: "Le message n’a pas pu être transmis.", success: "Message transmis. Notre équipe revient vers vous rapidement.",
    blocked: `Limite horaire atteinte (${MAX_PER_HOUR} messages/heure).`, blockedHelp: "Réessayez dans une heure ou écrivez-nous directement par email.",
    hidden: "Ne pas remplir", name: "Nom", namePlaceholder: "Votre nom", email: "Email", emailPlaceholder: "votre@email.com",
    organization: "Organisation", organizationPlaceholder: "École, entreprise, organisme…", role: "Votre rôle", rolePlaceholder: "Formation, RH, enseignement…",
    project: "Votre projet", audience: "Audience envisagée", message: "Message", precise: "À préciser",
    options: { demo: "Réserver une démonstration", enterprise: "Déploiement organisation", security: "Questionnaire sécurité", pilot: "Cas pilote documenté", education: "Éducation", event: "Événement", support: "Support produit", other: "Autre demande" },
    audiences: { small: "1 à 20 personnes", medium: "21 à 200 personnes", large: "201 à 1 000 personnes", xlarge: "Plus de 1 000 personnes" },
    securityPlaceholder: "Exigences, documents attendus, calendrier de revue…", pilotPlaceholder: "Public, scénario, indicateurs et conditions de publication…", messagePlaceholder: "Contexte, objectifs, calendrier, contraintes techniques…",
    transmitting: "Transmission…", patient: (seconds: number) => `Patienter ${seconds}s`, submit: "Envoyer le message",
  },
  en: {
    sent: "Message sent. We will reply shortly.", wait: (seconds: number) => `Please wait ${seconds}s before sending another message.`,
    hourly: "Hourly limit reached. Please try again in one hour.", short: "Your message is too short (20 characters minimum).", invalid: "This content is not valid.",
    transmissionError: "Your message could not be sent.", success: "Message sent. Our team will get back to you shortly.",
    blocked: `Hourly limit reached (${MAX_PER_HOUR} messages per hour).`, blockedHelp: "Try again in one hour or contact us directly by email.",
    hidden: "Do not fill in", name: "Name", namePlaceholder: "Your name", email: "Email", emailPlaceholder: "you@company.com",
    organization: "Organization", organizationPlaceholder: "School, company or institution", role: "Your role", rolePlaceholder: "Learning, HR, education or events",
    project: "Your project", audience: "Expected audience", message: "Message", precise: "Not specified",
    options: { demo: "Book a demonstration", enterprise: "Organization deployment", security: "Security questionnaire", pilot: "Documented pilot", education: "Education", event: "Event", support: "Product support", other: "Other request" },
    audiences: { small: "1 to 20 people", medium: "21 to 200 people", large: "201 to 1,000 people", xlarge: "More than 1,000 people" },
    securityPlaceholder: "Requirements, expected documents and review timeline", pilotPlaceholder: "Audience, scenario, indicators and publication conditions", messagePlaceholder: "Context, goals, timeline and technical requirements",
    transmitting: "Sending…", patient: (seconds: number) => `Wait ${seconds}s`, submit: "Send message",
  },
} as const;

export function ContactForm({ language = "fr" }: { language?: "fr" | "en" }) {
  const copy = COPY[language];
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
    const supportedIntent = ["demo", "enterprise", "education", "event", "security", "pilot", "support", "other"].includes(intent ?? "")
      ? intent as string
      : intent === "training" || intent === "integration"
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (honeypot) {
      toast.success(copy.sent);
      return;
    }

    if (cooldown > 0) {
      toast.error(copy.wait(cooldown));
      return;
    }

    const flood = loadFlood();
    const now = Date.now();
    const recentSubmits = flood.submits.filter((t) => now - t < 3600_000);
    if (recentSubmits.length >= MAX_PER_HOUR) {
      setHourlyBlocked(true);
      toast.error(copy.hourly);
      return;
    }

    if (formData.message.trim().length < 20) {
      toast.error(copy.short);
      return;
    }

    const msg = formData.message.trim();
    const urlOnly = /^https?:\/\/\S+$/.test(msg);
    const repeatedChar = /^(.)\1{9,}$/.test(msg.replace(/\s/g, ""));
    if (urlOnly || repeatedChar) {
      toast.error(copy.invalid);
      return;
    }

    setSubmitting(true);
    trackMarketingEvent("marketing_lead_submit", { requestType: formData.requestType });
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
      if (!response.ok) throw new Error(language === "en" ? copy.transmissionError : result.error || copy.transmissionError);

      saveFlood({ lastSubmit: now, submits: [...recentSubmits, now] });
      setCooldown(COOLDOWN_SECONDS);
      toast.success(copy.success);
      trackMarketingEvent("marketing_lead_success", { requestType: formData.requestType });
      setFormData({ name: "", email: "", organization: "", role: "", requestType: "demo", teamSize: "", message: "" });
    } catch (error) {
      trackMarketingEvent("marketing_lead_error", { requestType: formData.requestType });
      toast.error(error instanceof Error ? error.message : copy.transmissionError);
    } finally {
      setSubmitting(false);
    }
  };

  const isBlocked = cooldown > 0 || hourlyBlocked || submitting;

  if (hourlyBlocked) {
    return (
      <div className={styles.blocked}>
        <ClockGlyph large />
        <p>{copy.blocked}</p>
        <small>{copy.blockedHelp}</small>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.hidden} aria-hidden>
        <label htmlFor="contact-website">{copy.hidden}</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>

      <div className={styles.identityGrid}>
        <div>
          <label htmlFor="contact-name" className={styles.label}>{copy.name}</label>
          <input
            id="contact-name"
            className={styles.control}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={copy.namePlaceholder}
            required
          />
        </div>
        <div>
          <label htmlFor="contact-email" className={styles.label}>{copy.email}</label>
          <input
            id="contact-email"
            type="email"
            className={styles.control}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder={copy.emailPlaceholder}
            required
          />
        </div>
      </div>

      <div className={styles.identityGrid}>
        <div>
          <label htmlFor="contact-organization" className={styles.label}>{copy.organization}</label>
          <input
            id="contact-organization"
            className={styles.control}
            value={formData.organization}
            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
            placeholder={copy.organizationPlaceholder}
          />
        </div>
        <div>
          <label htmlFor="contact-role" className={styles.label}>{copy.role}</label>
          <input
            id="contact-role"
            className={styles.control}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            placeholder={copy.rolePlaceholder}
          />
        </div>
      </div>

      <div className={styles.identityGrid}>
        <div>
          <label htmlFor="contact-type" className={styles.label}>{copy.project}</label>
          <select
            id="contact-type"
            className={styles.control}
            value={formData.requestType}
            onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
          >
            <option value="demo">{copy.options.demo}</option>
            <option value="enterprise">{copy.options.enterprise}</option>
            <option value="security">{copy.options.security}</option>
            <option value="pilot">{copy.options.pilot}</option>
            <option value="education">{copy.options.education}</option>
            <option value="event">{copy.options.event}</option>
            <option value="support">{copy.options.support}</option>
            <option value="other">{copy.options.other}</option>
          </select>
        </div>
        <div>
          <label htmlFor="contact-team-size" className={styles.label}>{copy.audience}</label>
          <select
            id="contact-team-size"
            className={styles.control}
            value={formData.teamSize}
            onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
          >
            <option value="">{copy.precise}</option>
            <option value="1-20">{copy.audiences.small}</option>
            <option value="21-200">{copy.audiences.medium}</option>
            <option value="201-1000">{copy.audiences.large}</option>
            <option value="1000+">{copy.audiences.xlarge}</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className={styles.label}>{copy.message}</label>
        <textarea
          id="contact-message"
          className={`${styles.control} ${styles.messageControl}`}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          placeholder={formData.requestType === "security"
            ? copy.securityPlaceholder
            : formData.requestType === "pilot"
              ? copy.pilotPlaceholder
              : copy.messagePlaceholder}
          rows={6}
          required
        />
      </div>

      <button
        type="submit"
        className={styles.submitButton}
        disabled={isBlocked}
        aria-live="polite"
      >
        {submitting ? (
          <><span className={styles.spinner} aria-hidden="true" />{copy.transmitting}</>
        ) : cooldown > 0 ? (
          <><ClockGlyph />{copy.patient(cooldown)}</>
        ) : (
          <><SendGlyph />{copy.submit}</>
        )}
      </button>
    </form>
  );
}
