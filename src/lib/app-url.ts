import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";

export { getAppBaseUrl };

export function appUrl(path: string): string {
  const base = getAppBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export const BUILTIN_PRODUCTION_ORIGINS: string[] = [
  "https://transovo.ai",
  "https://www.transovo.ai",
];

export function publicReportShareUrl(shareToken: string): string {
  return appUrl(`/reports/share/${encodeURIComponent(shareToken)}`);
}

export function getTwilioSmsWebhookUrl(): string {
  return appUrl("/api/twilio/inbound");
}
