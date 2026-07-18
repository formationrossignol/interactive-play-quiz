import { describe, expect, it } from 'vitest';
import {
  AUDIENCE_CAP,
  CONTENT_CAPS,
  ADVANCED_QUIZ_TYPES,
  AudienceCapError,
  DEFAULT_PLAN,
  PlanLimitError,
  getPlan,
  isQuestionTypeLocked,
} from '../plans';

describe('getPlan', () => {
  it('defaults to starter when the user has no plan set', () => {
    expect(getPlan(null)).toBe('starter');
    expect(getPlan(undefined)).toBe('starter');
    expect(getPlan({})).toBe('starter');
    expect(getPlan({ plan: undefined })).toBe('starter');
  });

  it('returns the user\'s plan when set', () => {
    expect(getPlan({ plan: 'pro' })).toBe('pro');
    expect(getPlan({ plan: 'entreprise' })).toBe('entreprise');
  });
});

describe('CONTENT_CAPS', () => {
  it('caps starter at 5 for quiz/poll/flashcard/slide/exam and 1 for course', () => {
    expect(CONTENT_CAPS.starter).toEqual({
      quiz: 5, poll: 5, flashcard: 5, slide: 5, exam: 5, course: 1,
    });
  });

  it('is unlimited (null) on every kind for pro and entreprise', () => {
    for (const plan of ['pro', 'entreprise'] as const) {
      for (const kind of ['quiz', 'poll', 'flashcard', 'slide', 'exam', 'course'] as const) {
        expect(CONTENT_CAPS[plan][kind]).toBeNull();
      }
    }
  });
});

describe('AUDIENCE_CAP', () => {
  it('is 20 for starter, 200 for pro, unlimited for entreprise', () => {
    expect(AUDIENCE_CAP.starter).toBe(20);
    expect(AUDIENCE_CAP.pro).toBe(200);
    expect(AUDIENCE_CAP.entreprise).toBeNull();
  });
});

describe('isQuestionTypeLocked', () => {
  it('locks advanced quiz types for starter', () => {
    for (const type of ADVANCED_QUIZ_TYPES) {
      expect(isQuestionTypeLocked(type, 'starter')).toBe(true);
    }
  });

  it('never locks classic types', () => {
    for (const type of ['multiple-choice', 'true-false', 'short-answer']) {
      expect(isQuestionTypeLocked(type, 'starter')).toBe(false);
    }
  });

  it('never locks anything for pro or entreprise', () => {
    for (const type of ADVANCED_QUIZ_TYPES) {
      expect(isQuestionTypeLocked(type, 'pro')).toBe(false);
      expect(isQuestionTypeLocked(type, 'entreprise')).toBe(false);
    }
  });
});

describe('PlanLimitError', () => {
  it('carries the kind and cap, and has a human-readable message', () => {
    const err = new PlanLimitError('quiz', 5);
    expect(err.kind).toBe('quiz');
    expect(err.cap).toBe(5);
    expect(err.message).toContain('5');
    expect(err.name).toBe('PlanLimitError');
  });
});

describe('AudienceCapError', () => {
  it('has a participant-facing message and no plan-upsell wording', () => {
    const err = new AudienceCapError();
    expect(err.name).toBe('AudienceCapError');
    expect(err.message.toLowerCase()).not.toContain('pro');
  });
});

describe('DEFAULT_PLAN', () => {
  it('is starter', () => {
    expect(DEFAULT_PLAN).toBe('starter');
  });
});
