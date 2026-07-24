import Link from "next/link";
import { BrandMonogram } from "ui/BrandMonogram";
import { BrandWordmark } from "ui/BrandWordmark";
import { SocialLinksRow } from "@/components/SocialLinksRow";

// Mirrors apps/app/src/components/Footer.tsx. App-only routes (builder,
// discover, community) get a real <a> to APP_ORIGIN — full browser
// navigation, not next/link — same reasoning as Header.tsx's "Se connecter"
// (see docs/marketing-app-decoupling.md).
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://interactive-play-quiz.vercel.app";

type FooterLink = { label: string; href: string; external?: boolean };

const FOOTER_SECTIONS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "/features" },
      { label: "Tarifs", href: "/pricing" },
      { label: "Créer un quiz", href: `${APP_ORIGIN}/builder-start?type=quiz`, external: true },
      { label: "Découvrir", href: `${APP_ORIGIN}/discover`, external: true },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Aide", href: "/help" },
      { label: "Guides", href: "/guides" },
      { label: "Communauté", href: `${APP_ORIGIN}/community`, external: true },
      { label: "Avis", href: "/reviews" },
      { label: "Roadmap", href: "/roadmap" },
      { label: "Changelog", href: "/changelog" },
      { label: "Signaler un bug", href: "/report" },
    ],
  },
];

const LEGAL_LINKS = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "CGU", href: "/cgu" },
];

export function Footer() {
  return (
    <footer style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-paper-2)" }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <Link href="/" className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <span
              className="ap-logo"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: "var(--ap-r-md)", background: "var(--ap-brand)",
              }}
            >
              <BrandMonogram size={16} />
            </span>
            <BrandWordmark size={16} style={{ color: "var(--ap-ink)" }} />
          </Link>
          <p className="text-sm leading-relaxed" style={{ color: "var(--ap-muted)" }}>
            Quiz, sondages, flashcards et présentations interactives, en direct.
          </p>
          <SocialLinksRow />
        </div>

        <div className="grid flex-1 gap-8 sm:grid-cols-3">
          {FOOTER_SECTIONS.map((section) => (
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
                    {link.external ? (
                      <a
                        href={link.href}
                        className="text-sm font-semibold transition-colors hover:opacity-80"
                        style={{ color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)" }}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm font-semibold transition-colors hover:opacity-80"
                        style={{ color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)" }}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)" }}>
        <div
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4 text-xs font-bold"
          style={{ color: "var(--ap-muted)" }}
        >
          <span>© 2026 Brivia. Tous droits réservés.</span>
          <nav style={{ display: "flex", gap: "16px" }}>
            {LEGAL_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="transition-colors hover:opacity-80"
                style={{ color: "var(--ap-muted)", fontFamily: "var(--ap-font-body)" }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
