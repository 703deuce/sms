import { createHash } from "node:crypto";

/** Opaque, stable per Google event — not the raw Calendar API event id. */
export function stableGoogleDiscoveryBookingId(
  connectionId: string,
  calendarId: string,
  providerEventId: string,
): string {
  const digest = createHash("sha256")
    .update(`${connectionId}\0${calendarId}\0${providerEventId}`)
    .digest("base64url");
  return `gcal_disc_${digest.slice(0, 24)}`;
}
