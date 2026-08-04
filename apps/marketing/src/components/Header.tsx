"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMonogram } from "ui/BrandMonogram";
import { BrandWordmark } from "ui/BrandWordmark";
import { TRANSLATED_PATHS } from "@/lib/translatedPaths";
import styles from "./MarketingChrome.module.css";

// Locale is derived from the URL prefix via plain next/navigation, not
// next-intl's useLocale()/Link — next-intl's client context has proven
// unreliable for this component under Turbopack (crashes with "No intl
// context found" on some but not all [locale] routes, root cause not
// pinned down). Native Next.js primitives read the URL directly and don't
// depend on that context, which sidesteps the issue entirely.

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
      { label: "Live sessions", description: "Turn every audience into participants", href: "/en#demo" },
      { label: "Learning", description: "Courses, practice and active recall", href: "/en#experience-signature" },
      { label: "Assessment", description: "Measure and review understanding", href: "/en#question-types-home-title" },
    ],
  },
  {
    label: "Solutions",
    match: ["/en/solutions", "/en/enterprise"],
    items: [
      { label: "Education", description: "Make every class active", href: "/en/solutions/education" },
      { label: "Training", description: "Run sessions and document progress", href: "/en/solutions/training" },
      { label: "Enterprise", description: "Deploy with a clear framework", href: "/en/enterprise" },
      { label: "Events", description: "Give the room a direct voice", href: "/en/solutions/events" },
    ],
  },
  {
    label: "Trust",
    match: ["/en/security", "/en/about"],
    items: [
      { label: "Trust center", description: "Current controls and honest limits", href: "/en/security" },
      { label: "About", description: "Our vision and commitments", href: "/en/about" },
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
  const english = pathname === "/en" || pathname.startsWith("/en/");
  const strippedPathname = english ? (pathname.slice(3) || "/") : pathname;
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

  const switchTarget = TRANSLATED_PATHS.has(strippedPathname) ? strippedPathname : "/";
  const switchHref = english ? switchTarget : `/en${switchTarget === "/" ? "" : switchTarget}`;

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
          <Link href={english ? "/en/pricing" : "/pricing"} aria-current={pathname === (english ? "/en/pricing" : "/pricing") ? "page" : undefined}>{labels.pricing}</Link>
          <Link className={styles.languageLink} href={switchHref} hrefLang={english ? "fr" : "en"}>
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
              <Link href={english ? "/en/pricing" : "/pricing"} onClick={closeNavigation} tabIndex={mobileOpen ? undefined : -1}>
                <span>{labels.pricing}</span>
                <NavArrow />
              </Link>
              <Link href={switchHref} hrefLang={english ? "fr" : "en"} onClick={closeNavigation} tabIndex={mobileOpen ? undefined : -1}>
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
