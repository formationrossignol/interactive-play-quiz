import { describe, it, expect } from 'vitest';
import { createDefaultQuizQuestion } from '../questionDefaults';

describe('createDefaultQuizQuestion', () => {
  it('does not pre-select a correct answer for a new multiple-choice question', () => {
    const q = createDefaultQuizQuestion('multiple-choice');
    expect(q.correctAnswer).toBe(-1);
  });

  it('does not pre-select a correct answer for a new true-false question', () => {
    const q = createDefaultQuizQuestion('true-false');
    expect(q.correctAnswer).toBeUndefined();
  });

  it('falls back to no correct answer for an unknown type using the MC shape', () => {
    // @ts-expect-error deliberately invalid type to exercise the default branch
    const q = createDefaultQuizQuestion('not-a-real-type');
    expect(q.correctAnswer).toBe(-1);
  });
});
