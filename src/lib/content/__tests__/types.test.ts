import { describe, it, expect } from 'vitest';
import { CONTENT_TYPES, isContentType } from '../types';

describe('content types', () => {
  it('reconnaît les 5 types', () => {
    expect(CONTENT_TYPES).toEqual(['quiz','poll','flashcard','exam','course']);
  });
  it('isContentType rejette un type inconnu', () => {
    expect(isContentType('quiz')).toBe(true);
    expect(isContentType('foo')).toBe(false);
  });
});
