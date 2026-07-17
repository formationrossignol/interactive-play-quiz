// Site-wide visual themes (skins). Orthogonal to the light/dark mode toggle:
// the skin picks the token palette + typography, the mode picks its variant.
// The active skin is stamped on <html> as data-theme="<id>" (none for the
// default Arcade Pop) and every skin ships a light + dark token set.

export type SiteTheme = "arcade" | "thales" | "ynov";

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
      en: "Playful and colorful — the original look",
      fr: "Ludique et coloré — le style d'origine",
    },
    colors: ["#7048ff", "#ff5a4d", "#15c08a", "#ffb020"],
    previewFont: "'Fredoka Variable', 'Fredoka', system-ui, sans-serif",
  },
  {
    id: "thales",
    name: "Thales",
    tagline: {
      en: "Institutional — deep blue, sharp and sober",
      fr: "Institutionnel — bleu profond, sobre et net",
    },
    colors: ["#171F69", "#3CC2D2", "#0C0D29", "#FFFFFF"],
    previewFont: "'Gibson', 'Aptos', 'Segoe UI', Arial, Helvetica, sans-serif",
  },
  {
    id: "ynov",
    name: "Ynov Campus",
    tagline: {
      en: "Campus energy — black, white, turquoise",
      fr: "Énergie campus — noir, blanc, turquoise",
    },
    colors: ["#000000", "#00B8A9", "#FFFFFF", "#595959"],
    previewFont: "'Montserrat Variable', 'Montserrat', 'Aptos', Arial, Helvetica, sans-serif",
  },
];

export const DEFAULT_SITE_THEME: SiteTheme = "arcade";

export const normalizeSiteTheme = (raw: unknown): SiteTheme =>
  SITE_THEMES.some((t) => t.id === raw) ? (raw as SiteTheme) : DEFAULT_SITE_THEME;

/** Stamp the skin on <html>. Arcade Pop is the bare default (no attribute). */
export const applySiteTheme = (theme: SiteTheme) => {
  if (theme === DEFAULT_SITE_THEME) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
};
