import { Header } from "./Header";
import { Footer } from "./Footer";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import type { StaticPage } from "@/lib/types";
import styles from "./LegalPageLayout.module.css";

export function LegalPageLayout({ page }: { page: StaticPage }) {
  return (
    <div className={styles.shell}>
      <Header />
      <main id="main-content" className={styles.main}>
        <div className={styles.hero}>
          <header className={styles.heading}>
            <h1>{page.title}</h1>
            <p>{page.subtitle}</p>
          </header>
          <article className={styles.document}>
            <div className="static-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }} />
            <p className={styles.updated}>Dernière mise à jour : juillet 2026</p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
