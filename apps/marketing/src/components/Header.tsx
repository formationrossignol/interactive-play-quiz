"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMonogram } from "ui/BrandMonogram";
import { BrandWordmark } from "ui/BrandWordmark";
import styles from "./MarketingChrome.module.css";

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://app.brivia.app";

const NAV_MENUS = [
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
      { label: "Références", description: "Résultats et retours vérifiables", href: "/customers" },
      { label: "Confiance", description: "Sécurité et accessibilité", href: "/security" },
      { label: "À propos", description: "Notre vision et nos engagements", href: "/about" },
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
  const headerRef = useRef<HTMLElement>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const labels = {
    skip: "Aller au contenu",
    navigation: "Navigation principale",
    mobileNavigation: "Navigation mobile",
    home: "Brivia, accueil",
    login: "Se connecter",
    signup: "Créer un compte",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
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
        <Link href="/" className={styles.brand} aria-label={labels.home} onClick={closeNavigation}>
          <span className={styles.brandMark}>
            <BrandMonogram size={19} />
          </span>
          <BrandWordmark size={18} className={styles.wordmark} />
        </Link>

        <nav className={styles.desktopNav} aria-label={labels.navigation}>
          {NAV_MENUS.map((menu) => {
            const open = activeMenu === menu.label;
            const current = menu.match.some((prefix) => pathname.startsWith(prefix));
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
                  <span className={styles.navPanelLabel}>Explorer {menu.label.toLowerCase()}</span>
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
          <Link href="/pricing" aria-current={pathname === "/pricing" ? "page" : undefined}>Tarifs</Link>
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
            <p>De l’idée à une expérience collective qui compte.</p>
          </div>
          <div className={styles.mobileNavGroups}>
            {NAV_MENUS.map((menu) => (
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
              <p>Choisir</p>
              <Link href="/pricing" onClick={closeNavigation} tabIndex={mobileOpen ? undefined : -1}>
                <span>Tarifs</span>
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
