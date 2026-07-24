import { t } from "@/lib/i18n";
import { useCookieConsent } from "@/contexts/CookieConsentContext";

// Discreet app footer — not the marketing site's: no product/company/
// support columns, no logo, no social row. Just copyright, build version,
// and the legally-required links (see apps/marketing/Footer.tsx for the
// full marketing version, ported from this file's old shape).
export const Footer = () => {
  const { openPreferences } = useCookieConsent();

  return (
    <footer style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)" }}>
      <div
        className="mx-auto max-w-6xl px-6 py-4 text-xs font-bold"
        style={{ color: "var(--ap-muted)", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", justifyContent: "space-between" }}
      >
        <span>© 2026 Brivia · v{__APP_VERSION__}</span>
        <nav style={{ display: "flex", gap: "16px" }}>
          {[
            { label: t('footerMentionsLegales'), href: "/mentions-legales" },
            { label: t('footerPrivacy'), href: "/confidentialite" },
            { label: t('footerCGU'), href: "/cgu" },
          ].map(({ label, href }) => (
            // Real anchor, not react-router navigate(): these routes now
            // live in apps/marketing, need a full browser navigation for
            // the domain-level rewrite to route there (see
            // docs/marketing-app-decoupling.md).
            <a
              key={href}
              href={href}
              className="text-xs font-bold text-ap-muted hover:text-ap-brand focus-visible:text-ap-brand font-body transition-colors"
            >
              {label}
            </a>
          ))}
          <button
            type="button"
            onClick={openPreferences}
            className="text-xs font-bold text-ap-muted hover:text-ap-brand focus-visible:text-ap-brand font-body transition-colors"
          >
            Gérer les cookies
          </button>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
