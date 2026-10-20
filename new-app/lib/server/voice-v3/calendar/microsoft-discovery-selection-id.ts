import { createHash } from "node:crypto";

/** Opaque, stable per Microsoft event — not the raw Graph event id. */
export function stableMicrosoftDiscoveryBookingId(
  connectionId: string,
  calendarId: string,
  providerEventId: string,
): string {
  const digest = createHash("sha256")
    .update(`${connectionId}\0${calendarId}\0${providerEventId}`)
    .digest("base64url");
  return `ms_disc_${digest.slice(0, 24)}`;
}
