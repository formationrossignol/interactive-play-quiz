export const SITE_URL = "https://interactive-play-quiz.vercel.app";
export const SITE_NAME = "Ludiq";
export const DEFAULT_TITLE = "Ludiq — Quiz et sondages interactifs en temps réel";
export const DEFAULT_DESCRIPTION =
  "Créez des quiz multijoueurs, sondages live et présentations interactives. QR code, classement instantané et ambiance arcade — sans rien sacrifier en puissance.";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export function buildTitle(pageTitle?: string): string {
  return pageTitle ? `${pageTitle} · ${SITE_NAME}` : DEFAULT_TITLE;
}
