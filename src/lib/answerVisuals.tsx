/**
 * Source unique de vérité pour l'identité visuelle des réponses.
 *
 * Deux univers coexistent volontairement :
 *  - HOST  (grand écran, QuizSession) : tuiles pleines type plateau TV.
 *  - PLAYER (téléphone, PlayerView)   : cartes blanches Arcade Pop + puce
 *    géométrique colorée par position.
 *
 * Tout aperçu (builder, PreviewPage) DOIT consommer ces constantes pour
 * rester aligné sur les écrans réels.
 */

/** Tuiles réponses côté présentateur — thème standard. */
export const HOST_ANSWER_STYLES = [
  { bg: '#E74C3C', shadow: 'rgba(231,76,60,0.45)', shape: '▲' },
  { bg: '#2980B9', shadow: 'rgba(41,128,185,0.45)', shape: '◆' },
  { bg: '#F39C12', shadow: 'rgba(243,156,18,0.45)', shape: '●' },
  { bg: '#27AE60', shadow: 'rgba(39,174,96,0.45)', shape: '■' },
] as const;

/** Tuiles réponses côté présentateur — thème « Qui veut gagner ». */
export const MILLIONAIRE_ANSWER_STYLES = [
  { bg: 'rgba(8,12,40,0.88)', shadow: 'rgba(200,160,0,0.2)', shape: 'A' },
  { bg: 'rgba(8,12,40,0.88)', shadow: 'rgba(200,160,0,0.2)', shape: 'B' },
  { bg: 'rgba(8,12,40,0.88)', shadow: 'rgba(200,160,0,0.2)', shape: 'C' },
  { bg: 'rgba(8,12,40,0.88)', shadow: 'rgba(200,160,0,0.2)', shape: 'D' },
] as const;

/**
 * Formes géométriques côté joueur (puce de la carte .ap-answer).
 * L'ordre position → couleur est fixé par arcade-pop.css :
 *  1 = triangle / --ap-quiz (rouge)   2 = cercle / --ap-poll (bleu)
 *  3 = carré   / --ap-pres (vert)    4 = losange / --ap-flash (jaune)
 */
export const PLAYER_ANSWER_SHAPES = [
  <svg key="tri" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 2 L15 14 H1 Z"/></svg>,
  <svg key="cir" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="7"/></svg>,
  <svg key="sq" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="2"/></svg>,
  <svg key="dia" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1 L15 8 L8 15 L1 8 Z"/></svg>,
] as const;

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
