import { t } from "@/lib/i18n";
import { useCookieConsent } from "@/contexts/CookieConsentContext";

// Legal pages are owned by the separate Next.js marketing deployment. The
// product app is also deployed directly on its own *.vercel.app origin, where
// relative links would be swallowed by the SPA catch-all and render its 404.
// Keep the public deployment as a working default while allowing the custom
// marketing domain to be supplied per environment.
const MARKETING_ORIGIN = (
  import.meta.env.VITE_MARKETING_ORIGIN
  || "https://interactive-play-quiz-marketing.vercel.app"
).replace(/\/$/, "");

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
            <a
              key={href}
              href={`${MARKETING_ORIGIN}${href}`}
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
