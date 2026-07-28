// REQ-UI-003 / REQ-CNT-006: errors funnel through toast.error() uniformly
// throughout the app regardless of cause. This gives call sites a small,
// shared way to tag *why* an error happened so it gets appropriate
// treatment — not a rewrite of every toast.error() call, just the shared
// primitive plus its highest-traffic call sites.
import { toast } from 'sonner';
import { PlanLimitError } from './plans';

export type ErrorKind = 'validation' | 'business' | 'system';

export interface ClassifiedError {
  kind: ErrorKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

/** Tag for an error the caller already understands (bad input, a precondition
 *  that wasn't met) — distinct from an unexpected failure bubbling up from a
 *  network call or a bug. Throw this instead of a plain Error when the cause
 *  is "the user needs to fix something", not "something broke". */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const upgradeAction = { label: 'Passer Pro', onClick: () => { window.location.href = '/pricing'; } };
const retryAction = { label: 'Réessayer', onClick: () => { window.location.reload(); } };
const loginAction = { label: 'Se reconnecter', onClick: () => { window.location.href = '/auth'; } };
const backToContentAction = { label: 'Retour aux contenus', onClick: () => { window.location.href = '/dashboard'; } };
const refreshAction = { label: 'Actualiser', onClick: () => { window.location.reload(); } };
const requestAccessAction = {
  label: "Demander l’accès",
  onClick: () => {
    const subject = encodeURIComponent("Demande d’accès à une ressource Brivia");
    const body = encodeURIComponent(`Bonjour,\n\nPouvez-vous me donner accès à cette ressource ?\n${window.location.href}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  },
};

interface ErrorSignals {
  status: number | null;
  code: string;
  message: string;
}

function getErrorSignals(e: unknown): ErrorSignals {
  if (!e || typeof e !== 'object') return { status: null, code: '', message: '' };
  const candidate = e as { status?: number | string; statusCode?: number | string; code?: string; message?: string; details?: string };
  const rawStatus = Number(candidate.status ?? candidate.statusCode);
  return {
    status: Number.isFinite(rawStatus) ? rawStatus : null,
    code: String(candidate.code ?? ''),
    message: `${candidate.message ?? ''} ${candidate.details ?? ''}`.toLowerCase(),
  };
}

/** Pure: maps a caught value to its kind + display message. No I/O, so this
 *  is the part worth unit-testing directly. */
export function classifyError(e: unknown): ClassifiedError {
  if (e instanceof PlanLimitError) {
    return { kind: 'business', message: e.message, action: upgradeAction };
  }
  if (e instanceof ValidationError) {
    return { kind: 'validation', message: e.message };
  }
  const signals = getErrorSignals(e);
  if (
    signals.status === 401
    || signals.code === 'PGRST301'
    || /jwt expired|invalid jwt|session.*expired|not authenticated/.test(signals.message)
  ) {
    return {
      kind: 'business',
      message: 'Votre session a expiré. Reconnectez-vous pour continuer.',
      action: loginAction,
    };
  }
  if (
    signals.status === 403
    || signals.code === '42501'
    || /permission denied|forbidden|not authorized|not authorised|row-level security|insufficient privilege/.test(signals.message)
  ) {
    return {
      kind: 'business',
      message: "Vous n’avez pas les droits pour modifier cette ressource.",
      action: requestAccessAction,
    };
  }
  if (signals.status === 404 || signals.code === 'PGRST116' || /not found|introuvable/.test(signals.message)) {
    return {
      kind: 'business',
      message: 'Cette ressource est introuvable ou a été supprimée.',
      action: backToContentAction,
    };
  }
  if (signals.status === 409 || signals.code === '23505' || /conflict|duplicate key/.test(signals.message)) {
    return {
      kind: 'business',
      message: 'Cette ressource a été modifiée ailleurs. Actualisez la page avant de recommencer.',
      action: refreshAction,
    };
  }
  if (signals.status === 429 || /rate limit|too many requests/.test(signals.message)) {
    return {
      kind: 'business',
      message: 'Trop de demandes ont été envoyées. Patientez quelques secondes puis réessayez.',
      action: retryAction,
    };
  }
  if (signals.status === 408 || signals.status === 504 || /timeout|timed out/.test(signals.message)) {
    return {
      kind: 'system',
      message: 'La demande a pris trop de temps. Vérifiez votre connexion puis réessayez.',
      action: retryAction,
    };
  }
  if (
    e instanceof TypeError
    || /failed to fetch|networkerror|network error|econnreset|offline/.test(signals.message)
  ) {
    return {
      kind: 'system',
      message: 'Connexion impossible. Vérifiez votre accès Internet puis réessayez.',
      action: retryAction,
    };
  }
  return {
    kind: 'system',
    message: 'L’action n’a pas abouti. Réessayez ou rechargez la page.',
    action: retryAction,
  };
}

/**
 * Toasts a caught error with kind-appropriate treatment. System errors are
 * always logged to the console (so they're diagnosable, since the toast
 * itself never has enough detail for that) — validation/business errors are
 * expected outcomes, not console noise. `context` is a short label (e.g.
 * the component name) prefixed on the console line, not shown to the user.
 *
 * `fallbackMessage`, when given, replaces the raw error message for
 * *system*-kind errors only — business/validation messages are already
 * hand-written (PlanLimitError, ValidationError) and are shown as-is. Use
 * this at call sites that already have a specific friendly string for their
 * "something unexpected happened" case, so adopting the taxonomy doesn't
 * regress a good message into a raw exception string.
 */
export function showError(e: unknown, context?: string, fallbackMessage?: string): ClassifiedError {
  const classified = classifyError(e);
  if (classified.kind === 'system') {
    console.error(context ? `[${context}]` : '[error]', e);
  }
  const message = classified.kind === 'system' && fallbackMessage ? fallbackMessage : classified.message;
  toast.error(message, classified.action ? { action: classified.action } : undefined);
  return classified;
}
