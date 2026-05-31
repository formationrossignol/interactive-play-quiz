import { useNavigate } from "react-router-dom";
import { t } from "@/lib/i18n";

export const Footer = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

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
        { label: t('footerAbout') },
        { label: t('footerCareers') },
        { label: t('footerContact') },
      ],
    },
    {
      title: t('footerSupport'),
      links: [
        { label: t('footerHelpCenter') },
        { label: t('footerGuides') },
        { label: t('footerCommunity') },
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
                        className="text-sm font-semibold transition-colors"
                        style={{ color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--ap-brand)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--ap-ink)";
                        }}
                      >
                        {link.label}
                      </button>
                    ) : (
                      <span className="text-sm font-semibold" style={{ color: "var(--ap-muted)" }}>
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
          style={{ color: "var(--ap-muted)" }}
        >
          © {currentYear} {t('footerRights')}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
