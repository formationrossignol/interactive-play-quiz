export type Plan = 'starter' | 'pro' | 'entreprise';

export type ContentKind = 'quiz' | 'poll' | 'flashcard' | 'slide' | 'exam' | 'course';

export const DEFAULT_PLAN: Plan = 'starter';

/** Creation caps per plan per content kind. null = unlimited. */
export const CONTENT_CAPS: Record<Plan, Record<ContentKind, number | null>> = {
  starter: { quiz: 5, poll: 5, flashcard: 5, slide: 5, exam: 5, course: 1 },
  pro: { quiz: null, poll: null, flashcard: null, slide: null, exam: null, course: null },
  entreprise: { quiz: null, poll: null, flashcard: null, slide: null, exam: null, course: null },
};

/**
 * "How many people can experience this content" — quiz/poll live rooms and
 * exam attempts (distinct participants) both read this, via two different
 * mechanisms (see examStorage.ts). null = unlimited.
 */
export const AUDIENCE_CAP: Record<Plan, number | null> = {
  starter: 20,
  pro: 200,
  entreprise: null,
};

/** Quiz-builder-only gating. Poll/flashcard/exam question types are unaffected. */
export const ADVANCED_QUIZ_TYPES = ['ranking', 'matching', 'fill-blank', 'slider'] as const;

export const PLAN_LABELS: Record<Plan, string> = {
  starter: 'Starter',
  pro: 'Pro',
  entreprise: 'Entreprise',
};

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  quiz: 'quiz',
  poll: 'sondages',
  flashcard: 'jeux de cartes',
  slide: 'présentations',
  exam: 'examens',
  course: 'cours',
};

export function getPlan(user: { plan?: Plan } | null | undefined): Plan {
  return user?.plan ?? DEFAULT_PLAN;
}

export function isQuestionTypeLocked(type: string, plan: Plan): boolean {
  return plan === 'starter' && (ADVANCED_QUIZ_TYPES as readonly string[]).includes(type);
}

/**
 * Thrown by the storage layer when a creation would exceed the user's plan
 * cap. Creator-facing — the catching UI shows an "Upgrade to Pro" action.
 */
export class PlanLimitError extends Error {
  kind: ContentKind;
  cap: number;
  plan: Plan;

  constructor(kind: ContentKind, cap: number, plan: Plan = 'starter') {
    super(
      `Limite du plan ${PLAN_LABELS[plan]} atteinte (${cap} ${CONTENT_KIND_LABELS[kind]} max). ` +
      `Passez au plan Pro pour continuer.`
    );
    this.name = 'PlanLimitError';
    this.kind = kind;
    this.cap = cap;
    this.plan = plan;
  }
}

/**
 * Thrown when a live room or exam is at its audience cap. Participant-
 * facing — the catching UI must NOT offer a plan upsell (the participant
 * isn't the account holder).
 */
export class AudienceCapError extends Error {
  constructor() {
    super("Capacité maximale atteinte. Contactez l'organisateur.");
    this.name = 'AudienceCapError';
  }
}
