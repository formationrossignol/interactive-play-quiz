import { t } from "@/lib/i18n";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { marketingUrl } from "@/lib/marketingOrigin";

// Legal pages are owned by the separate Next.js marketing deployment. The
// product app is also deployed directly on its own *.vercel.app origin, where
// relative links would be swallowed by the SPA catch-all and render its 404.
// Keep the public deployment as a working default while allowing the custom
// marketing domain to be supplied per environment.
// Discreet app footer, separate from the marketing site's full navigation.
// It keeps only copyright and legally required links (see apps/marketing/Footer.tsx for the
// full marketing version, ported from this file's old shape).
export const Footer = () => {
  const { openPreferences } = useCookieConsent();

  return (
    <footer style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)" }}>
      <div
        className="mx-auto max-w-6xl px-6 py-5 text-xs font-semibold"
        style={{ color: "var(--ap-muted)", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", justifyContent: "space-between" }}
      >
        <span>© 2026 Brivia</span>
        <nav style={{ display: "flex", gap: "16px" }}>
          {[
            { label: t('footerMentionsLegales'), href: "/mentions-legales" },
            { label: t('footerPrivacy'), href: "/confidentialite" },
            { label: t('footerCGU'), href: "/cgu" },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={marketingUrl(href)}
              className="font-body text-xs font-semibold text-ap-muted transition-colors hover:text-ap-brand focus-visible:text-ap-brand"
            >
              {label}
            </a>
          ))}
          <button
            type="button"
            onClick={openPreferences}
            className="font-body text-xs font-semibold text-ap-muted transition-colors hover:text-ap-brand focus-visible:text-ap-brand"
          >
            Gérer les cookies
          </button>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
