import { describe, it, expect } from 'vitest';
import { isSiteThemeExemptPath, resolveSiteThemeForPath, FORCED_SITE_THEME } from '../siteTheme';

describe('isSiteThemeExemptPath', () => {
  it('exempts pre-auth/onboarding routes', () => {
    expect(isSiteThemeExemptPath('/')).toBe(true);
    expect(isSiteThemeExemptPath('/auth')).toBe(true);
    expect(isSiteThemeExemptPath('/reset-password')).toBe(true);
    expect(isSiteThemeExemptPath('/invite/abc123')).toBe(true);
    expect(isSiteThemeExemptPath('/onboarding/org')).toBe(true);
    expect(isSiteThemeExemptPath('/org/invitations')).toBe(true);
  });

  it('exempts live game/exam-taking screens', () => {
    expect(isSiteThemeExemptPath('/quiz/ABCD12')).toBe(true);
    expect(isSiteThemeExemptPath('/join/ABCD12')).toBe(true);
    expect(isSiteThemeExemptPath('/join-exam')).toBe(true);
    expect(isSiteThemeExemptPath('/join-exam/XYZ99')).toBe(true);
    expect(isSiteThemeExemptPath('/take/XYZ99')).toBe(true);
    expect(isSiteThemeExemptPath('/presentation-audience')).toBe(true);
    expect(isSiteThemeExemptPath('/preview/quiz-id-1')).toBe(true);
  });

  it('exempts the theme picker itself so every skin stays previewable', () => {
    expect(isSiteThemeExemptPath('/profile')).toBe(true);
  });

  it('does not exempt correction/admin/library surfaces — Material 3 is forced there', () => {
    expect(isSiteThemeExemptPath('/dashboard')).toBe(false);
    expect(isSiteThemeExemptPath('/grading')).toBe(false);
    expect(isSiteThemeExemptPath('/exam/exam-1/admin')).toBe(false);
    expect(isSiteThemeExemptPath('/my-quizzes')).toBe(false);
    expect(isSiteThemeExemptPath('/notifications')).toBe(false);
    expect(isSiteThemeExemptPath('/admin')).toBe(false);
  });

  it('does not false-positive on prefix overlap (/join-exam vs /joining-exam-report)', () => {
    expect(isSiteThemeExemptPath('/joining-exam-report')).toBe(false);
  });
});

describe('resolveSiteThemeForPath', () => {
  it('returns the visitor pick on an exempt route', () => {
    expect(resolveSiteThemeForPath('/quiz/ABCD12', 'thales')).toBe('thales');
    expect(resolveSiteThemeForPath('/profile', 'studio')).toBe('studio');
  });

  it('forces Material 3 on a non-exempt route regardless of the visitor pick', () => {
    expect(resolveSiteThemeForPath('/dashboard', 'thales')).toBe(FORCED_SITE_THEME);
    expect(resolveSiteThemeForPath('/grading', 'arcade')).toBe(FORCED_SITE_THEME);
  });
});
