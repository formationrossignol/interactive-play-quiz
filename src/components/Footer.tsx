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
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-card">
              <span className="font-extrabold text-lg">Q</span>
            </div>
            <div>
              <p className="font-extrabold text-xl text-foreground">{t('quizMaster')}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">{t('footerTagline')}</p>
            </div>
          </div>
          <p className="mt-6 text-sm leading-relaxed text-foreground/65">{t('footerDescription')}</p>
        </div>

        <div className="grid flex-1 gap-8 sm:grid-cols-3">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-foreground/60">{section.title}</h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.onClick ? (
                      <button
                        type="button"
                        onClick={link.onClick}
                        className="text-sm text-foreground/70 transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <span className="text-sm text-foreground/40">{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-foreground/50">
          © {currentYear} {t('footerRights')}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
