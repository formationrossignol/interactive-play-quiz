"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMonogram } from "ui/BrandMonogram";
import { BrandWordmark } from "ui/BrandWordmark";

// Everything under /builder, /auth, etc. is proxied to the app deployment
// (see next.config.ts fallback rewrite) — "Se connecter" just links there.
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://interactive-play-quiz.vercel.app";

const NAV_LINKS = [
  { label: "Fonctionnalités", href: "/features" },
  { label: "Tarifs", href: "/pricing" },
  { label: "Aide", href: "/help" },
  { label: "À propos", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        borderBottom: "var(--ap-border-w) solid var(--ap-line)",
        background: "var(--ap-paper)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span
            className="ap-logo"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, borderRadius: "var(--ap-r-md)", background: "var(--ap-brand)",
            }}
          >
            <BrandMonogram size={20} />
          </span>
          <BrandWordmark size={18} style={{ color: "var(--ap-ink)" }} />
        </Link>

        <nav className="ap-nav-pill hidden sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="ap-nav-pill__item"
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <a
          href={`${APP_ORIGIN}/auth`}
          className="rounded-full px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--ap-brand)", fontFamily: "var(--ap-font-display)" }}
        >
          Se connecter
        </a>
      </div>
    </header>
  );
}
