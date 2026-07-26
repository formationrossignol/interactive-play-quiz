import { describe, it, expect } from 'vitest';
import { levenshtein, fuzzyScore } from '../fuzzyMatch';

describe('levenshtein', () => {
  it('is 0 for identical strings', () => {
    expect(levenshtein('quiz', 'quiz')).toBe(0);
  });
  it('counts a single substitution', () => {
    expect(levenshtein('quiz', 'quiy')).toBe(1);
  });
  it('counts insertions/deletions', () => {
    expect(levenshtein('quiz', 'quizz')).toBe(1);
    expect(levenshtein('quiz', 'qui')).toBe(1);
  });
  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
});

describe('fuzzyScore', () => {
  it('scores an exact substring match as 0', () => {
    expect(fuzzyScore('mon', 'Capitales du monde')).toBe(0);
  });
  it('is case/diacritic-insensitive', () => {
    expect(fuzzyScore('SCHEMA', 'Schéma électrique')).toBe(0);
  });
  it('tolerates a single-character typo', () => {
    expect(fuzzyScore('quizz', 'Quiz de culture générale')).not.toBeNull();
  });
  it('matches against individual words in a multi-word title, not just the whole string', () => {
    expect(fuzzyScore('geographie', 'Quiz de Géographie mondiale')).not.toBeNull();
  });
  it('rejects unrelated queries', () => {
    expect(fuzzyScore('xyzabc', 'Capitales du monde')).toBeNull();
  });
  it('returns null for an empty query', () => {
    expect(fuzzyScore('', 'Capitales du monde')).toBeNull();
  });
});
