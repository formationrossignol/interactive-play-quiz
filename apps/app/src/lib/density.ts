// Display density — orthogonal to site skin and light/dark mode. Persisted
// the same way as theme/siteTheme (see auth.ts updateProfile). Stamped on
// <html> as data-density="<id>" (none for the default "standard").

export type Density = "compact" | "standard" | "comfortable";

export const DEFAULT_DENSITY: Density = "standard";

export const DENSITIES: { id: Density; label: { en: string; fr: string } }[] = [
  { id: "compact", label: { en: "Compact", fr: "Compacte" } },
  { id: "standard", label: { en: "Standard", fr: "Standard" } },
  { id: "comfortable", label: { en: "Comfortable", fr: "Confortable" } },
];

export const normalizeDensity = (raw: unknown): Density =>
  DENSITIES.some((d) => d.id === raw) ? (raw as Density) : DEFAULT_DENSITY;

export const applyDensity = (density: Density) => {
  if (density === DEFAULT_DENSITY) {
    document.documentElement.removeAttribute("data-density");
  } else {
    document.documentElement.setAttribute("data-density", density);
  }
};
