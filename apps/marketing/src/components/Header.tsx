"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMonogram } from "ui/BrandMonogram";
import { BrandWordmark } from "ui/BrandWordmark";
import { isEnglishPath, languageCounterpart } from "@/lib/marketingLocale";
import styles from "./MarketingChrome.module.css";

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://app.brivia.app";

const FRENCH_NAV_MENUS = [
  {
    label: "Produit",
    match: ["/features", "/integrations"],
    items: [
      { label: "Vue d’ensemble", description: "L’expérience Brivia complète", href: "/features" },
      { label: "Sessions en direct", description: "Faites participer toute la salle", href: "/features#live-sessions" },
      { label: "Apprentissage", description: "Cours, flashcards et parcours", href: "/features#learning-paths" },
      { label: "Évaluation", description: "Mesurez et restituez les acquis", href: "/features#assessment" },
      { label: "Intégrations", description: "Reliez contenus et résultats", href: "/integrations" },
    ],
  },
  {
    label: "Solutions",
    match: ["/solutions", "/enterprise"],
    items: [
      { label: "Enseignement", description: "Rendez chaque cours actif", href: "/solutions/education" },
      { label: "Formation", description: "Animez et prouvez la progression", href: "/solutions/training" },
      { label: "Entreprises", description: "Déployez avec un cadre maîtrisé", href: "/enterprise" },
      { label: "Événements", description: "Transformez l’audience en participants", href: "/solutions/events" },
    ],
  },
  {
    label: "Ressources",
    match: ["/guides", "/help", "/customers", "/security", "/accessibility", "/about"],
    items: [
      { label: "Guides", description: "Méthodes et bonnes pratiques", href: "/guides" },
      { label: "Centre d’aide", description: "Réponses et documentation", href: "/help" },
      { label: "Clients", description: "Résultats et références vérifiables", href: "/customers" },
      { label: "Confiance", description: "Sécurité et accessibilité", href: "/security" },
      { label: "À propos", description: "Notre vision et nos engagements", href: "/about" },
    ],
  },
] as const;

const ENGLISH_NAV_MENUS = [
  {
    label: "Product",
    match: ["/en"],
    items: [
      { label: "Overview", description: "The complete Brivia experience", href: "/en" },
      { label: "Live sessions", description: "Turn every audience into participants", href: "/en#live" },
      { label: "Learning", description: "Courses, practice and active recall", href: "/en#learning" },
      { label: "Assessment", description: "Measure and review understanding", href: "/en#assessment" },
    ],
  },
  {
    label: "Solutions",
    match: ["/en/enterprise"],
    items: [
      { label: "Education", description: "Make every class active", href: "/en#education" },
      { label: "Training", description: "Run sessions and document progress", href: "/en#training" },
      { label: "Enterprise", description: "Deploy with a clear framework", href: "/en/enterprise" },
      { label: "Events", description: "Give the room a direct voice", href: "/en#events" },
    ],
  },
  {
    label: "Trust",
    match: ["/en/security"],
    items: [
      { label: "Trust center", description: "Current controls and honest limits", href: "/en/security" },
      { label: "Privacy", description: "How Brivia handles personal data", href: "/confidentialite" },
      { label: "Accessibility", description: "Inclusive use and current status", href: "/accessibility" },
    ],
  },
] as const;

function NavChevron({ open = false }: { open?: boolean }) {
  return (
    <svg className={open ? styles.chevronOpen : undefined} viewBox="0 0 12 12" aria-hidden="true">
      <path d="m2.4 4.3 3.6 3.4 3.6-3.4" />
    </svg>
  );
}

function NavArrow() {
  return (
    <svg className={styles.navArrow} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M4 9h9M9.5 5.5 13 9l-3.5 3.5" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const english = isEnglishPath(pathname);
  const navMenus = english ? ENGLISH_NAV_MENUS : FRENCH_NAV_MENUS;
  const headerRef = useRef<HTMLElement>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const labels = english ? {
    skip: "Skip to content",
    navigation: "Main navigation",
    mobileNavigation: "Mobile navigation",
    home: "Brivia home",
    login: "Log in",
    signup: "Create account",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    pricing: "Pricing",
    mobileIntro: "From the first question to evidence your team can use.",
    choose: "Choose",
    explore: "Explore",
  } : {
    skip: "Aller au contenu",
    navigation: "Navigation principale",
    mobileNavigation: "Navigation mobile",
    home: "Brivia, accueil",
    login: "Se connecter",
    signup: "Créer un compte",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    pricing: "Tarifs",
    mobileIntro: "De l’idée à une expérience collective qui compte.",
    choose: "Choisir",
    explore: "Explorer",
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (activeMenu && headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveMenu(null);
        setMobileOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeMenu]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileOpen]);

  const closeNavigation = () => {
    setActiveMenu(null);
    setMobileOpen(false);
  };

  return (
    <header className={styles.header} ref={headerRef}>
      <a className={styles.skipLink} href="#main-content">
        {labels.skip}
      </a>

      <div className={styles.headerInner}>
        <Link href={english ? "/en" : "/"} className={styles.brand} aria-label={labels.home} onClick={closeNavigation}>
          <span className={styles.brandMark}>
            <BrandMonogram size={19} />
          </span>
          <BrandWordmark size={18} className={styles.wordmark} />
        </Link>

        <nav className={styles.desktopNav} aria-label={labels.navigation}>
          {navMenus.map((menu) => {
            const open = activeMenu === menu.label;
            const current = menu.match.some((prefix) =>
              prefix === "/en" ? pathname === prefix : pathname.startsWith(prefix),
            );
            const panelId = `nav-${menu.label.toLowerCase()}`;

            return (
              <div className={styles.navMenu} key={menu.label}>
                <button
                  type="button"
                  className={styles.navTrigger}
                  aria-expanded={open}
                  aria-controls={panelId}
                  aria-current={current ? "page" : undefined}
                  onClick={() => setActiveMenu(open ? null : menu.label)}
                >
                  {menu.label}
                  <NavChevron open={open} />
                </button>
                <div
                  id={panelId}
                  className={`${styles.navPanel} ${open ? styles.navPanelOpen : ""}`}
                  aria-hidden={!open}
                >
                  <span className={styles.navPanelLabel}>{labels.explore} {menu.label.toLowerCase()}</span>
                  {menu.items.map((item) => (
                    <Link href={item.href} key={item.href} onClick={closeNavigation} tabIndex={open ? undefined : -1}>
                      <span><b>{item.label}</b><small>{item.description}</small></span>
                      <NavArrow />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
          {!english && <Link href="/pricing" aria-current={pathname === "/pricing" ? "page" : undefined}>{labels.pricing}</Link>}
          <Link className={styles.languageLink} href={languageCounterpart(pathname)} hrefLang={english ? "fr" : "en"}>
            {english ? "FR" : "EN"}
          </Link>
        </nav>

        <div className={styles.headerActions}>
          <a className={styles.loginLink} href={`${APP_ORIGIN}/auth`}>{labels.login}</a>
          <a className={styles.signupLink} href={`${APP_ORIGIN}/auth?view=register`}>
            <span>{labels.signup}</span>
            <NavArrow />
          </a>
          <button
            type="button"
            className={`${styles.mobileToggle} ${mobileOpen ? styles.mobileToggleOpen : ""}`}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileOpen ? labels.closeMenu : labels.openMenu}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span /><span />
          </button>
        </div>
      </div>

      <div
        id="mobile-navigation"
        className={`${styles.mobileOverlay} ${mobileOpen ? styles.mobileOverlayOpen : ""}`}
        aria-hidden={!mobileOpen}
      >
        <nav className={styles.mobileNav} aria-label={labels.mobileNavigation}>
          <div className={styles.mobileNavIntro}>
            <span>Navigation</span>
            <p>{labels.mobileIntro}</p>
          </div>
          <div className={styles.mobileNavGroups}>
            {navMenus.map((menu) => (
              <section className={styles.mobileNavGroup} key={menu.label}>
                <p>{menu.label}</p>
                {menu.items.map((item) => (
                  <Link href={item.href} key={item.href} onClick={closeNavigation} tabIndex={mobileOpen ? undefined : -1}>
                    <span>{item.label}</span>
                    <NavArrow />
                  </Link>
                ))}
              </section>
            ))}
            <section className={`${styles.mobileNavGroup} ${styles.mobilePricing}`}>
              <p>{labels.choose}</p>
              {!english && <Link href="/pricing" onClick={closeNavigation} tabIndex={mobileOpen ? undefined : -1}>
                <span>{labels.pricing}</span>
                <NavArrow />
              </Link>}
              <Link href={languageCounterpart(pathname)} hrefLang={english ? "fr" : "en"} onClick={closeNavigation} tabIndex={mobileOpen ? undefined : -1}>
                <span>{english ? "Français" : "English"}</span>
                <NavArrow />
              </Link>
            </section>
          </div>
          <div className={styles.mobileAccountActions}>
            <a className={styles.mobileLogin} href={`${APP_ORIGIN}/auth`} tabIndex={mobileOpen ? undefined : -1}>{labels.login}</a>
            <a className={styles.mobileSignup} href={`${APP_ORIGIN}/auth?view=register`} tabIndex={mobileOpen ? undefined : -1}>
              <span>{labels.signup}</span><NavArrow />
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
