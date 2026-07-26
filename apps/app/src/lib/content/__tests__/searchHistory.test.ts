import { describe, it, expect, beforeEach } from 'vitest';
import { getRecentSearches, addRecentSearch, removeRecentSearch } from '../searchHistory';

beforeEach(() => {
  localStorage.clear();
});

describe('searchHistory', () => {
  it('starts empty', () => {
    expect(getRecentSearches('u1')).toEqual([]);
  });

  it('adds most-recent-first', () => {
    addRecentSearch('u1', 'quiz maths');
    addRecentSearch('u1', 'sondage');
    expect(getRecentSearches('u1')).toEqual(['sondage', 'quiz maths']);
  });

  it('dedupes case-insensitively, moving the existing entry to the front', () => {
    addRecentSearch('u1', 'Quiz Maths');
    addRecentSearch('u1', 'sondage');
    addRecentSearch('u1', 'quiz maths');
    expect(getRecentSearches('u1')).toEqual(['quiz maths', 'sondage']);
  });

  it('caps at 5 entries', () => {
    for (let i = 0; i < 8; i++) addRecentSearch('u1', `query-${i}`);
    expect(getRecentSearches('u1')).toHaveLength(5);
    expect(getRecentSearches('u1')[0]).toBe('query-7');
  });

  it('ignores blank queries', () => {
    addRecentSearch('u1', '   ');
    expect(getRecentSearches('u1')).toEqual([]);
  });

  it('removes a specific entry', () => {
    addRecentSearch('u1', 'a');
    addRecentSearch('u1', 'b');
    removeRecentSearch('u1', 'a');
    expect(getRecentSearches('u1')).toEqual(['b']);
  });

  it('keeps histories separate per user', () => {
    addRecentSearch('u1', 'from u1');
    addRecentSearch('u2', 'from u2');
    expect(getRecentSearches('u1')).toEqual(['from u1']);
    expect(getRecentSearches('u2')).toEqual(['from u2']);
  });
});
