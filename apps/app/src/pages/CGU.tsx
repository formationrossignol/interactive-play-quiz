import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { useStaticPage } from "@/lib/pages/hooks";
import { STATIC_PAGE_DEFAULTS, mergeStaticPage } from "@/lib/pages/staticPageDefaults";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import "./static-pages.css";

const CGU = () => {
  useSEO({ title: "Conditions générales d'utilisation", path: "/cgu" });
  const { data } = useStaticPage("cgu");
  const page = mergeStaticPage(STATIC_PAGE_DEFAULTS.cgu, data);
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main style={{ flex: 1, maxWidth: "760px", margin: "0 auto", padding: "60px 24px" }}>
        <h1 style={{ fontFamily: "var(--ap-font-display)", fontSize: "36px", fontWeight: 600, marginBottom: "8px", color: "var(--ap-ink)" }}>
          {page.title}
        </h1>
        <p style={{ color: "var(--ap-muted)", fontSize: "14px", marginBottom: "48px" }}>{page.subtitle}</p>
        <div className="static-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }} />
        <p style={{ color: "var(--ap-muted)", fontSize: "13px", marginTop: "48px" }}>
          Dernière mise à jour : juillet 2026
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default CGU;
