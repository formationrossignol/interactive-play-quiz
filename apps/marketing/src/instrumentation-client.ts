// Client-side error tracking bootstrap (Next 16's instrumentation-client.ts
// file convention). No-op when NEXT_PUBLIC_SENTRY_DSN isn't set, so local
// dev/CI never needs a real DSN — see the 2026-07-28 commercial-readiness
// audit (memory: commercial-readiness-audit-2026-07-28), which found no
// error tracking anywhere in either app.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, sendDefaultPii: false });
}
