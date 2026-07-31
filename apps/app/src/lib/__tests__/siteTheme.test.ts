import { describe, it, expect } from 'vitest';
import { DEFAULT_SITE_THEME, resolveSiteThemeForPath } from '../siteTheme';

describe('resolveSiteThemeForPath', () => {
  it('returns the profile choice on every product route', () => {
    expect(resolveSiteThemeForPath('/quiz/ABCD12', 'thales')).toBe('thales');
    expect(resolveSiteThemeForPath('/profile', 'studio')).toBe('studio');
    expect(resolveSiteThemeForPath('/dashboard', 'arcade')).toBe('arcade');
    expect(resolveSiteThemeForPath('/grading', 'material')).toBe('material');
  });

  it('uses Arcade Pop when no valid preference exists', () => {
    expect(DEFAULT_SITE_THEME).toBe('arcade');
    expect(resolveSiteThemeForPath('/dashboard', undefined)).toBe('arcade');
    expect(resolveSiteThemeForPath('/my-quizzes', 'unknown')).toBe('arcade');
  });
});
