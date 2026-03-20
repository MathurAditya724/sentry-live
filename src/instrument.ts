import * as Sentry from "@sentry/bun";

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ??
    "https://1cefd35dcf3fc4c6f5d9e1fd8bce7f61@o4509750817325057.ingest.us.sentry.io/4511077782716416",
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  includeLocalVariables: true,
  enableLogs: true,
});
