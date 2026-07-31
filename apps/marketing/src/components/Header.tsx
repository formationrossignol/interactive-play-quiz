"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, Languages } from "lucide-react";
import { BrandMonogram } from "ui/BrandMonogram";
import { BrandWordmark } from "ui/BrandWordmark";
import { useMarketingLanguage } from "./MarketingLanguage";
import styles from "./MarketingChrome.module.css";

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://interactive-play-quiz.vercel.app";

const NAV_LINKS = [
  { label: { fr: "Tarifs", en: "Pricing" }, href: "/pricing" },
  { label: { fr: "Avis", en: "Reviews" }, href: "/reviews" },
  { label: { fr: "Guides", en: "Guides" }, href: "/guides" },
  { label: { fr: "Aide", en: "Help" }, href: "/help" },
  { label: { fr: "À propos", en: "About" }, href: "/about" },
  { label: { fr: "Contact", en: "Contact" }, href: "/contact" },
] as const;

const FEATURE_LINKS = {
  formats: [
    { label: { fr: "Vue d’ensemble", en: "Overview" }, description: { fr: "Tout ce que Brivia réunit", en: "Everything Brivia brings together" }, href: "/features" },
    { label: { fr: "Quiz", en: "Quizzes" }, description: { fr: "15 types de questions", en: "15 question types" }, href: "/features#format-quiz" },
    { label: { fr: "Sondages", en: "Polls" }, description: { fr: "Votes, échelles et verbatims", en: "Votes, scales and feedback" }, href: "/features#format-polls" },
    { label: { fr: "Flashcards", en: "Flashcards" }, description: { fr: "Révision active", en: "Active recall" }, href: "/features#format-flashcards" },
    { label: { fr: "Présentations", en: "Presentations" }, description: { fr: "Slides et mode présentateur", en: "Slides and presenter mode" }, href: "/features#format-presentations" },
    { label: { fr: "Examens", en: "Exams" }, description: { fr: "Passage et surveillance", en: "Assessment and proctoring" }, href: "/features#format-exams" },
    { label: { fr: "Cours", en: "Courses" }, description: { fr: "Parcours, SCORM et H5P", en: "Learning paths, SCORM and H5P" }, href: "/features#format-courses" },
  ],
  capabilities: [
    { label: { fr: "Sessions en direct", en: "Live sessions" }, href: "/features#live-sessions" },
    { label: { fr: "Parcours pédagogiques", en: "Learning paths" }, href: "/features#learning-paths" },
    { label: { fr: "Évaluation", en: "Assessment" }, href: "/features#assessment" },
    { label: { fr: "Collaboration", en: "Collaboration" }, href: "/features#collaboration" },
    { label: { fr: "Résultats et exports", en: "Results and exports" }, href: "/features#results" },
    { label: { fr: "Comparatif du marché", en: "Market comparison" }, href: "/features#comparatif" },
  ],
} as const;

export function Header() {
  const pathname = usePathname();
  const { language, setLanguage } = useMarketingLanguage();
  const labels = language === "fr"
    ? {
        skip: "Aller au contenu",
        navigation: "Navigation principale",
        mobileNavigation: "Navigation mobile",
        home: "Brivia, accueil",
        login: "Se connecter",
        signup: "Créer un compte",
        features: "Fonctionnalités",
        formats: "Formats",
        capabilities: "Fonctions avancées",
        allFeatures: "Voir toutes les fonctionnalités",
        menu: "Menu",
        language: "Langue du site",
      }
    : {
        skip: "Skip to content",
        navigation: "Main navigation",
        mobileNavigation: "Mobile navigation",
        home: "Brivia, home",
        login: "Log in",
        signup: "Create account",
        features: "Features",
        formats: "Formats",
        capabilities: "Advanced features",
        allFeatures: "See all features",
        menu: "Menu",
        language: "Website language",
      };

  const navigation = (mobile = false) => (
    <nav className={mobile ? styles.mobileNav : styles.desktopNav} aria-label={mobile ? labels.mobileNavigation : labels.navigation}>
      <details className={mobile ? styles.mobileFeatureMenu : styles.featureMenu}>
        <summary aria-current={pathname.startsWith("/features") ? "page" : undefined}>
          {labels.features}
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <div className={mobile ? styles.mobileFeaturePanel : styles.featurePanel}>
          <div className={styles.featureFormats}>
            <strong>{labels.formats}</strong>
            <div>
              {FEATURE_LINKS.formats.map((link) => (
                <Link
                  href={link.href}
                  key={link.href}
                  onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
                >
                  <span>
                    <b>{link.label[language]}</b>
                    <small>{link.description[language]}</small>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
          <div className={styles.featureCapabilities}>
            <strong>{labels.capabilities}</strong>
            <div>
              {FEATURE_LINKS.capabilities.map((link) => (
                <Link
                  href={link.href}
                  key={link.href}
                  onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
                >
                  {link.label[language]}
                </Link>
              ))}
            </div>
            <Link
              className={styles.allFeatures}
              href="/features"
              onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
            >
              {labels.allFeatures}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </details>
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? "page" : undefined}
        >
          {link.label[language]}
        </Link>
      ))}
    </nav>
  );

  return (
    <header className={styles.header}>
      <a className={styles.skipLink} href="#main-content">
        {labels.skip}
      </a>

      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand} aria-label={labels.home}>
          <span className={styles.brandMark}>
            <BrandMonogram size={19} />
          </span>
          <BrandWordmark size={18} className={styles.wordmark} />
        </Link>

        {navigation()}

        <div className={styles.headerActions}>
          <label className={styles.languageSwitch}>
            <Languages size={16} aria-hidden="true" />
            <span className={styles.srOnly}>{labels.language}</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as "fr" | "en")}
              aria-label={labels.language}
            >
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </label>
          <a className={styles.loginLink} href={`${APP_ORIGIN}/auth`}>
            {labels.login}
          </a>
          <a className={styles.signupLink} href={`${APP_ORIGIN}/auth?view=register`}>
            {labels.signup}
          </a>

          <details className={styles.mobileMenu}>
            <summary>{labels.menu}</summary>
            <div className={styles.mobileMenuPanel}>
              {navigation(true)}
              <div className={styles.mobileAccountActions}>
                <a className={styles.mobileLogin} href={`${APP_ORIGIN}/auth`}>
                  {labels.login}
                </a>
                <a className={styles.mobileSignup} href={`${APP_ORIGIN}/auth?view=register`}>
                  {labels.signup}
                </a>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
