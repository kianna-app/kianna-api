import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN_BACKEND;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    sendDefaultPii: false,

    beforeSend(event) {
      if (event.request) {
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-zapi-token'];
        }
        if (event.request.query_string && typeof event.request.query_string === 'string') {
          event.request.query_string = event.request.query_string.replace(
            /token=[^&]+/gi,
            'token=[REDACTED]',
          );
        }
        if (event.request.data && typeof event.request.data === 'object') {
          scrubObject(event.request.data as Record<string, unknown>);
        }
      }

      if (event.extra) scrubObject(event.extra);
      if (event.contexts) {
        for (const ctx of Object.values(event.contexts)) {
          if (ctx && typeof ctx === 'object') scrubObject(ctx as Record<string, unknown>);
        }
      }

      return event;
    },
  });
} else {
  console.warn('[Sentry] SENTRY_DSN_BACKEND não definido — Sentry desativado');
}

const SENSITIVE_KEYS = new Set([
  'password',
  'senha',
  'token',
  'authorization',
  'wpp_token',
  'authToken',
  'access_token',
  'refresh_token',
  'supabase_service_role_key',
  'service_role_key',
  'anon_key',
  'cliente_wpp',
  'whatsapp',
  'telefone',
  'cpf',
]);

function scrubObject(obj: Record<string, unknown>, depth = 0): void {
  if (depth > 5) return;
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      obj[key] = '[REDACTED]';
    } else if (obj[key] && typeof obj[key] === 'object') {
      scrubObject(obj[key] as Record<string, unknown>, depth + 1);
    }
  }
}
