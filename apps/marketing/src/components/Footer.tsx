"use client";

import Link from "next/link";
import { BrandMonogram } from "ui/BrandMonogram";
import { BrandWordmark } from "ui/BrandWordmark";
import { SocialLinksRow } from "@/components/SocialLinksRow";
import styles from "./MarketingChrome.module.css";

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://app.brivia.app";

export function Footer() {
  const content = {
        home: "Brivia, accueil",
        statement: "Concevoir, animer et mesurer dans un seul espace.",
        summary: "Des formats interactifs pour faire participer, vérifier les acquis et améliorer chaque session.",
        productLabel: "Produit",
        resourcesLabel: "Ressources",
        companyLabel: "Entreprise",
        legalLabel: "Liens légaux",
        copyright: "© 2026 Brivia. Tous droits réservés.",
        product: [
          ["Fonctionnalités", "/features"],
          ["Quiz", "/features#format-quiz"],
          ["Sondages", "/features#format-polls"],
          ["Examens", "/features#format-exams"],
          ["Cours", "/features#format-courses"],
        ],
        resources: [
          ["Tarifs", "/pricing"],
          ["Guides", "/guides"],
          ["Centre d’aide", "/help"],
          ["Avis clients", "/reviews"],
          ["Intégrations", "/integrations"],
          ["Communauté", `${APP_ORIGIN}/community`],
        ],
        company: [
          ["Entreprise", "/enterprise"],
          ["Sécurité", "/security"],
          ["Accessibilité", "/accessibility"],
          ["À propos", "/about"],
          ["Contact", "/contact"],
          ["Roadmap", `${APP_ORIGIN}/roadmap`],
          ["Changelog", `${APP_ORIGIN}/changelog`],
        ],
        legal: [
          ["Mentions légales", "/mentions-legales"],
          ["Confidentialité", "/confidentialite"],
          ["CGU", "/cgu"],
        ],
      };

  const footerLink = ([label, href]: string[]) =>
    href.startsWith("http")
      ? <a key={href} href={href}>{label}</a>
      : <Link key={href} href={href}>{label}</Link>;

  return (
    <footer id="site-footer" className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <Link href="/" className={styles.brand} aria-label={content.home}>
            <span className={styles.brandMark}>
              <BrandMonogram size={18} />
            </span>
            <BrandWordmark size={18} className={styles.wordmark} />
          </Link>
          <p className={styles.footerStatement}>{content.statement}</p>
          <p>{content.summary}</p>
          <SocialLinksRow />
        </div>

        <div className={styles.footerNavigation}>
          <nav aria-label={content.productLabel}>
            <h2>{content.productLabel}</h2>
            {content.product.map(footerLink)}
          </nav>
          <nav aria-label={content.resourcesLabel}>
            <h2>{content.resourcesLabel}</h2>
            {content.resources.map(footerLink)}
          </nav>
          <nav aria-label={content.companyLabel}>
            <h2>{content.companyLabel}</h2>
            {content.company.map(footerLink)}
          </nav>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <span>{content.copyright}</span>
        <nav aria-label={content.legalLabel}>
          {content.legal.map(footerLink)}
        </nav>
      </div>
    </footer>
  );
}
