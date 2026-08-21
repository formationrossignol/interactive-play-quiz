import { myAccessibilityPreferences, type AccessibilityPreferences } from './lms/accessibility';

/**
 * Mirrors accessibility_preferences onto <html data-a11y-*>, consumed by the
 * global CSS in packages/ui/components.css (data-a11y-contrast/data-a11y-motion).
 * Previously accessibility_preferences was written and read back only by the
 * settings screen itself (pages/lms/Accessibility.tsx) — the toggles existed
 * but nothing in the app ever applied their effect (spec 05 §"Socle
 * application", RESTE-A-FAIRE.md). font_size/spacing/text_to_speech aren't
 * wired here: no UI control writes them yet (only high_contrast/reduce_motion
 * have a Switch in PreferencesPanel), so there's nothing real to apply.
 */
export function applyAccessibilityPreferences(prefs: AccessibilityPreferences | null): void {
  const root = document.documentElement;
  if (prefs?.high_contrast) root.setAttribute('data-a11y-contrast', 'high');
  else root.removeAttribute('data-a11y-contrast');

  if (prefs?.reduce_motion) root.setAttribute('data-a11y-motion', 'reduce');
  else root.removeAttribute('data-a11y-motion');
}

/** Fetches the signed-in user's saved preferences and applies them. Failure
 *  (signed out, RLS, network) clears the attributes rather than leaving a
 *  stale state from a previous session on the same device/browser profile. */
export async function loadAndApplyAccessibilityPreferences(): Promise<void> {
  try {
    applyAccessibilityPreferences(await myAccessibilityPreferences());
  } catch {
    applyAccessibilityPreferences(null);
  }
}
