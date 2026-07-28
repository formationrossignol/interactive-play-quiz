// Server-side error tracking bootstrap (Next 16's instrumentation.ts file
// convention) — see instrumentation-client.ts for the client-side half.
import * as Sentry from '@sentry/nextjs';

export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    Sentry.init({ dsn, sendDefaultPii: false });
  }
}

export const onRequestError = Sentry.captureRequestError;
