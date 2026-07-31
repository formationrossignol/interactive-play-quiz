import type { ReactNode } from "react";
import { BrandMonogram } from "ui/BrandMonogram";
import { BrandWordmark } from "ui/BrandWordmark";
import { marketingUrl } from "@/lib/marketingOrigin";
import styles from "./PublicAccessShell.module.css";

interface PublicAccessShellProps {
  title: string;
  description: string;
  children: ReactNode;
  centered?: boolean;
}

export function PublicAccessShell({
  title,
  description,
  children,
  centered = false,
}: PublicAccessShellProps) {
  const homeUrl = marketingUrl("/");
  const currentYear = new Date().getFullYear();

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.brand} href={homeUrl} aria-label="Retour à l’accueil Brivia">
          <span className={styles.brandMark}>
            <BrandMonogram size={20} diamondColor="#c7d2fe" />
          </span>
          <BrandWordmark size={20} />
        </a>
        <a className={styles.homeLink} href={homeUrl}>Voir le site Brivia</a>
      </header>

      <section className={styles.main} aria-labelledby="public-access-title">
        <div className={`${styles.panel}${centered ? ` ${styles.centered}` : ""}`}>
          <header className={styles.intro}>
            <h1 id="public-access-title">{title}</h1>
            <p>{description}</p>
          </header>
          <div className={styles.surface}>{children}</div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>© {currentYear} Brivia. Données hébergées en Europe.</span>
        <nav aria-label="Informations légales">
          <a href={marketingUrl("/confidentialite")}>Confidentialité</a>
          <a href={marketingUrl("/cgu")}>Conditions d’utilisation</a>
          <a href={marketingUrl("/help")}>Aide</a>
        </nav>
      </footer>
    </main>
  );
}
