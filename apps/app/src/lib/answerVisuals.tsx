/**
 * Source unique de vérité pour l'identité visuelle des réponses.
 *
 * Deux univers coexistent volontairement :
 *  - HOST  (grand écran, QuizSession) : tuiles pleines type plateau TV.
 *  - PLAYER (téléphone, PlayerView)   : cartes blanches Arcade Pop + repère
 *    alphabétique coloré par position.
 *
 * Tout aperçu (builder, PreviewPage) DOIT consommer ces constantes pour
 * rester aligné sur les écrans réels.
 */

/** Tuiles réponses côté présentateur — thème standard. */
export const HOST_ANSWER_STYLES = [
  { bg: '#E74C3C', shadow: 'rgba(231,76,60,0.45)', shape: 'A' },
  { bg: '#2980B9', shadow: 'rgba(41,128,185,0.45)', shape: 'B' },
  { bg: '#F39C12', shadow: 'rgba(243,156,18,0.45)', shape: 'C' },
  { bg: '#27AE60', shadow: 'rgba(39,174,96,0.45)', shape: 'D' },
] as const;

/** Tuiles réponses côté présentateur — thème « Qui veut gagner ». */
export const MILLIONAIRE_ANSWER_STYLES = [
  { bg: 'rgba(8,12,40,0.88)', shadow: 'rgba(200,160,0,0.2)', shape: 'A' },
  { bg: 'rgba(8,12,40,0.88)', shadow: 'rgba(200,160,0,0.2)', shape: 'B' },
  { bg: 'rgba(8,12,40,0.88)', shadow: 'rgba(200,160,0,0.2)', shape: 'C' },
  { bg: 'rgba(8,12,40,0.88)', shadow: 'rgba(200,160,0,0.2)', shape: 'D' },
] as const;

/**
 * Repères alphabétiques côté joueur (puce de la carte .ap-answer).
 * Les mêmes lettres A–D sont utilisées dans le builder, l'aperçu, l'écran
 * joueur et l'écran présentateur pour ne plus obliger à traduire des formes.
 */
export const PLAYER_ANSWER_SHAPES = ['A', 'B', 'C', 'D'] as const;

/** Couleur de puce joueur par position (mêmes tokens que .ap-answer--N). */
export const PLAYER_ANSWER_COLORS = [
  'var(--ap-quiz)',
  'var(--ap-poll)',
  'var(--ap-pres)',
  'var(--ap-flash)',
] as const;

/** Piles de polices proposées dans le builder (id → CSS font-family). */
export const FONT_STACKS: Record<string, string> = {
  inter: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  poppins: '"Poppins", "Inter", sans-serif',
  'space-grotesk': '"Space Grotesk", "Inter", sans-serif',
  playfair: '"Playfair Display", "Times New Roman", serif',
  merriweather: '"Merriweather", "Georgia", serif',
};

/** Résout un id de police (ou une stack brute) en CSS font-family. */
export const resolveFontFamily = (font?: string): string | undefined =>
  font ? FONT_STACKS[font] ?? font : undefined;
