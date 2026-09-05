/** Public Transovo Video meeting URL helpers. */

export function publicVideoMeetingUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  const path = `/video/${encodeURIComponent(token)}`;
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

export function telnyxVideoWebhookUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  const path = "/api/webhooks/telnyx/video-rooms";
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}
