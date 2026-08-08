// Product visual themes (skins). Orthogonal to the light/dark mode toggle:
// the skin picks the token palette + typography, the mode picks its variant.
// The marketing application owns its own visual system; these themes belong
// to the product and Arcade Pop remains the original application default.

export type SiteTheme = "arcade" | "thales" | "innov" | "studio" | "material" | "nova" | "materialpro";

export interface SiteThemeDef {
  id: SiteTheme;
  name: string;
  /** Short pitch shown under the name in the profile picker, per language. */
  tagline: { en: string; fr: string };
  /** Swatches previewed in the picker, most identifying first. */
  colors: [string, string, string, string];
  /** Font stack used to render the "Aa" specimen in the picker. */
  previewFont: string;
}

export const SITE_THEMES: SiteThemeDef[] = [
  {
    id: "arcade",
    name: "Arcade Pop",
    tagline: {
      en: "Playful and colorful, the original application look",
      fr: "Ludique et coloré, l’identité originale de l’application",
    },
    colors: ["#7048ff", "#ff5a4d", "#15c08a", "#ffb020"],
    previewFont: "'Fredoka Variable', 'Fredoka', system-ui, sans-serif",
  },
  {
    id: "thales",
    name: "Thales",
    tagline: {
      en: "Institutional: deep blue, sharp and sober",
      fr: "Institutionnel : bleu profond, sobre et net",
    },
    colors: ["#171F69", "#3CC2D2", "#0C0D29", "#FFFFFF"],
    previewFont: "'Gibson', 'Aptos', 'Segoe UI', Arial, Helvetica, sans-serif",
  },
  {
    id: "innov",
    name: "Innov Campus",
    tagline: {
      en: "Campus energy: black, white and turquoise",
      fr: "Énergie campus : noir, blanc et turquoise",
    },
    colors: ["#000000", "#00B8A9", "#FFFFFF", "#595959"],
    previewFont: "'Montserrat Variable', 'Montserrat', 'Aptos', Arial, Helvetica, sans-serif",
  },
  {
    id: "studio",
    name: "Studio",
    tagline: {
      en: "Sober and editorial, designed as a learning studio",
      fr: "Sobre et éditorial, pensé comme un studio pédagogique",
    },
    colors: ["#5B4FE9", "#172033", "#FFFFFF", "#FF7657"],
    previewFont: "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif",
  },
  {
    id: "material",
    name: "Material 3",
    tagline: {
      en: "Adaptive and calm: role-based color and tonal surfaces",
      fr: "Adaptatif et calme : couleurs par rôle et surfaces tonales",
    },
    colors: ["#65558F", "#EADDFF", "#625B71", "#7D5260"],
    previewFont: "'Roboto Flex Variable', 'Roboto Flex', system-ui, sans-serif",
  },
  {
    id: "nova",
    name: "Nova",
    tagline: {
      en: "Soft violet SaaS system with a dark, brand-forward sidebar",
      fr: "Système SaaS violet et doux, sidebar sombre à forte présence de marque",
    },
    colors: ["#7C5CFA", "#1B1C26", "#14B8A6", "#D9A441"],
    previewFont: "'Outfit Variable', 'Outfit', system-ui, sans-serif",
  },
  {
    id: "materialpro",
    name: "Midnight Pro",
    tagline: {
      en: "Premium midnight SaaS interface with a restrained indigo accent",
      fr: "Interface SaaS premium nocturne, structurée par un indigo maîtrisé",
    },
    colors: ["#080B12", "#10141D", "#6C63FF", "#F5F7FA"],
    previewFont: "'Poppins', 'Aptos', 'Segoe UI', system-ui, sans-serif",
  },
];

export const DEFAULT_SITE_THEME: SiteTheme = "arcade";

// "ynov" is the old id (pre-rename) — still present in already-saved
// profiles, mapped forward so existing users don't silently lose their pick.
const LEGACY_THEME_IDS: Record<string, SiteTheme> = { ynov: "innov" };

export const normalizeSiteTheme = (raw: unknown): SiteTheme => {
  if (typeof raw === "string" && raw in LEGACY_THEME_IDS) return LEGACY_THEME_IDS[raw];
  return SITE_THEMES.some((t) => t.id === raw) ? (raw as SiteTheme) : DEFAULT_SITE_THEME;
};

/** Stamp the selected product skin on <html>. Arcade Pop is the base skin. */
export const applySiteTheme = (theme: SiteTheme) => {
  if (theme === "arcade") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
};

/** Resolve the selected product theme on every route. Keeping the pathname in
 *  the signature avoids churn at call sites and leaves room for future
 *  route-specific presentation themes without overriding a profile choice. */
export const resolveSiteThemeForPath = (_pathname: string, userSiteTheme: unknown): SiteTheme =>
  normalizeSiteTheme(userSiteTheme);
