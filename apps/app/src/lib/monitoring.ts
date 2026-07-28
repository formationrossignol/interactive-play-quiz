import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';

/** Error tracking + product analytics bootstrap. Both are strict no-ops when
 *  their env var is unset, so local dev never needs a real DSN/key — see the
 *  2026-07-28 commercial-readiness audit (memory: commercial-readiness-audit-
 *  2026-07-28), which found neither existed anywhere in the app. Call once,
 *  before the app renders. */
export function initMonitoring(): void {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (sentryDsn) {
    Sentry.init({ dsn: sentryDsn, sendDefaultPii: false });
  }

  const posthogKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com',
      capture_pageview: false, // fired manually on route change — see usePostHogPageview
      person_profiles: 'identified_only',
    });
  }
}

export function isPostHogEnabled(): boolean {
  return Boolean(import.meta.env.VITE_POSTHOG_KEY);
}

export { posthog };
