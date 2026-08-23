/**
 * Public app origin for webhooks, tracked links, and unsubscribe URLs.
 */
export function getAppBaseUrl(): string {
  const fromEnv =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

/** Absolute URL path on the public app host. */
export function appUrl(path: string): string {
  const base = getAppBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export const WEBHOOK_PATHS = {
  twilioSms: "/api/webhooks/twilio/sms",
  brevoInbound: "/api/webhooks/brevo/inbound",
  brevoEvents: "/api/webhooks/brevo/events",
  unsubscribe: "/api/reputation/unsubscribe",
} as const;

export function getTwilioSmsWebhookUrl(): string {
  return (
    process.env.TWILIO_WEBHOOK_URL?.trim() ||
    process.env.TWILIO_STATUS_CALLBACK_URL?.trim() ||
    appUrl(WEBHOOK_PATHS.twilioSms)
  );
}

export function getBrevoInboundWebhookUrl(): string {
  return appUrl(WEBHOOK_PATHS.brevoInbound);
}

export function getBrevoEventsWebhookUrl(): string {
  return appUrl(WEBHOOK_PATHS.brevoEvents);
}
