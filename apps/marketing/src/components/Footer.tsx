import Link from "next/link";
import { BrandMonogram } from "ui/BrandMonogram";
import { BrandWordmark } from "ui/BrandWordmark";

const LEGAL_LINKS = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "CGU", href: "/cgu" },
];

export function Footer() {
  return (
    <footer style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-paper-2)" }}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-10">
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
