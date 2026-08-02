"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
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

export function Header() {
  const pathname = usePathname();
  // Keep the public switch honest: English returns when the full content,
  // metadata and legal corpus are localized, not only the navigation chrome.
  const labels = {
        skip: "Aller au contenu",
        navigation: "Navigation principale",
        mobileNavigation: "Navigation mobile",
        home: "Brivia, accueil",
        login: "Se connecter",
        signup: "Créer un compte",
        menu: "Menu",
      };

  const navigation = (mobile = false) => (
    <nav className={mobile ? styles.mobileNav : styles.desktopNav} aria-label={mobile ? labels.mobileNavigation : labels.navigation}>
      {NAV_MENUS.map((menu) => (
        <details className={mobile ? styles.mobileNavMenu : styles.navMenu} key={menu.label}>
          <summary aria-current={menu.match.some((prefix) => pathname.startsWith(prefix)) ? "page" : undefined}>
            {menu.label}
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className={mobile ? styles.mobileNavPanel : styles.navPanel}>
            {menu.items.map((item) => (
              <Link
                href={item.href}
                key={item.href}
                onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
              >
                <span><b>{item.label}</b><small>{item.description}</small></span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </details>
      ))}
      <Link href="/pricing" aria-current={pathname === "/pricing" ? "page" : undefined}>Tarifs</Link>
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
