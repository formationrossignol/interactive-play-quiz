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
const requestAccessAction = {
  label: "Demander l’accès",
  onClick: () => {
    const subject = encodeURIComponent("Demande d’accès à une ressource Brivia");
    const body = encodeURIComponent(`Bonjour,\n\nPouvez-vous me donner accès à cette ressource ?\n${window.location.href}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  },
};

function isPermissionError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const candidate = e as { status?: number; code?: string; message?: string; details?: string };
  const message = `${candidate.message ?? ''} ${candidate.details ?? ''}`.toLowerCase();
  return candidate.status === 403
    || candidate.code === '42501'
    || candidate.code === 'PGRST301'
    || /permission denied|forbidden|not authorized|not authorised|row-level security|insufficient privilege/.test(message);
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
  if (isPermissionError(e)) {
    return {
      kind: 'business',
      message: "Vous n’avez pas les droits pour modifier cette ressource.",
      action: requestAccessAction,
    };
  }
  return {
    kind: 'system',
    message: e instanceof Error ? e.message : 'Une erreur inattendue est survenue.',
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
