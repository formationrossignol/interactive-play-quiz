import { useNavigate } from "react-router-dom";
import { t } from "@/lib/i18n";

export const Footer = () => {
  const navigate = useNavigate();

  const footerSections = [
    {
      title: t('footerProduct'),
      links: [
        { label: t('features'), onClick: () => navigate('/features') },
        { label: t('pricing'), onClick: () => navigate('/pricing') },
        { label: t('footerBuilder'), onClick: () => navigate('/builder-start?type=quiz') },
        { label: t('discoverPublic'), onClick: () => navigate('/discover') },
      ],
    },
    {
      title: t('footerCompany'),
      links: [
        { label: t('footerAbout'), onClick: () => navigate('/about') },
        { label: t('footerCareers') },
        { label: t('footerContact'), onClick: () => navigate('/contact') },
      ],
    },
    {
      title: t('footerSupport'),
      links: [
        { label: t('footerHelpCenter'), onClick: () => navigate('/help') },
        { label: t('footerGuides'), onClick: () => navigate('/guides') },
        { label: t('footerCommunity'), onClick: () => navigate('/community') },
        { label: t('footerTestimonials'), onClick: () => navigate('/reviews') },
        { label: t('footerRoadmap'), onClick: () => navigate('/roadmap') },
        { label: t('footerChangelog'), onClick: () => navigate('/changelog') },
        { label: t('footerReport'), onClick: () => navigate('/report') },
      ],
    },
  ];

  return (
    <footer style={{ borderTop: "2px solid var(--ap-line)", background: "var(--ap-paper-2)" }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <div className="ap-row ap-gap-12" style={{ marginBottom: "16px" }}>
            <span className="ap-logo">
              <svg viewBox="0 0 24 24"><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"/></svg>
            </span>
            <div>
              <p className="ap-brandname" style={{ fontSize: "18px" }}>{t('quizMaster')}</p>
              <p className="text-xs font-bold uppercase tracking-widest mt-0.5" style={{ color: "var(--ap-muted)" }}>
                {t('footerTagline')}
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--ap-muted)" }}>
            {t('footerDescription')}
          </p>
        </div>

        <div className="grid flex-1 gap-8 sm:grid-cols-3">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--ap-muted)" }}
              >
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.onClick ? (
                      <button
                        type="button"
                        onClick={link.onClick}
                        className="text-sm font-semibold text-ap-ink hover:text-ap-brand focus-visible:text-ap-brand font-body transition-colors"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <span className="text-sm font-semibold text-ap-muted">
                        {link.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: "2px solid var(--ap-line)" }}>
        <div
          className="mx-auto max-w-6xl px-6 py-4 text-xs font-bold"
          style={{ color: "var(--ap-muted)", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", justifyContent: "space-between" }}
        >
          <span>© 2026 Ludiq. Tous droits réservés.</span>
          <nav style={{ display: "flex", gap: "16px" }}>
            {[
              { label: t('footerMentionsLegales'), href: "/mentions-legales" },
              { label: t('footerPrivacy'), href: "/confidentialite" },
              { label: t('footerCGU'), href: "/cgu" },
            ].map(({ label, href }) => (
              <button
                key={href}
                type="button"
                onClick={() => navigate(href)}
                className="text-xs font-bold text-ap-muted hover:text-ap-brand focus-visible:text-ap-brand font-body transition-colors"
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
