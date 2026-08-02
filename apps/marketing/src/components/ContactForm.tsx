"use client";

import { useState, useEffect, useRef } from "react";
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
        <ClockGlyph large />
        <p>Limite horaire atteinte ({MAX_PER_HOUR} messages/heure).</p>
        <small>Réessayez dans une heure ou écrivez-nous directement par email.</small>
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
          <label htmlFor="contact-name" className={styles.label}>Nom</label>
          <input
            id="contact-name"
            className={styles.control}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Votre nom"
            required
          />
        </div>
        <div>
          <label htmlFor="contact-email" className={styles.label}>Email</label>
          <input
            id="contact-email"
            type="email"
            className={styles.control}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="votre@email.com"
            required
          />
        </div>
      </div>

      <div className={styles.identityGrid}>
        <div>
          <label htmlFor="contact-organization" className={styles.label}>Organisation</label>
          <input
            id="contact-organization"
            className={styles.control}
            value={formData.organization}
            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
            placeholder="École, entreprise, organisme…"
          />
        </div>
        <div>
          <label htmlFor="contact-role" className={styles.label}>Votre rôle</label>
          <input
            id="contact-role"
            className={styles.control}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            placeholder="Formation, RH, enseignement…"
          />
        </div>
      </div>

      <div className={styles.identityGrid}>
        <div>
          <label htmlFor="contact-type" className={styles.label}>Votre projet</label>
          <select
            id="contact-type"
            className={styles.control}
            value={formData.requestType}
            onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
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
          <label htmlFor="contact-team-size" className={styles.label}>Audience envisagée</label>
          <select
            id="contact-team-size"
            className={styles.control}
            value={formData.teamSize}
            onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
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
        <label htmlFor="contact-message" className={styles.label}>Message</label>
        <textarea
          id="contact-message"
          className={`${styles.control} ${styles.messageControl}`}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          placeholder="Contexte, objectifs, calendrier, contraintes techniques…"
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
          <><span className={styles.spinner} aria-hidden="true" />Transmission…</>
        ) : cooldown > 0 ? (
          <><ClockGlyph />Patienter {cooldown}s</>
        ) : (
          <><SendGlyph />Envoyer le message</>
        )}
      </button>
    </form>
  );
}
