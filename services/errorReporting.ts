/**
 * Optional crash reporting. The SDK is loaded lazily and only when a DSN is
 * configured, so deployments without VITE_SENTRY_DSN pay zero bundle and
 * runtime cost. No PII is attached — anonymous product analytics already
 * covers funnels; this is purely for unhandled errors.
 */
type SentryModule = typeof import('@sentry/react');

let sentry: Promise<SentryModule | null> | null = null;

export function initErrorReporting(): void {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!import.meta.env.PROD || !dsn) return;
    sentry = import('@sentry/react')
        .then(Sentry => {
            Sentry.init({
                dsn,
                sendDefaultPii: false,
                tracesSampleRate: 0
            });
            return Sentry;
        })
        .catch(() => null);
}

export function captureError(error: unknown): void {
    void sentry?.then(Sentry => Sentry?.captureException(error));
}
