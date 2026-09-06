/** Canonical external id for calendar-imported appointments (not Transovo-booked). */
export function formatImportedExternalId(
  provider: "google" | "microsoft",
  connectionId: string,
  providerEventId: string,
) {
  return `${provider}:${connectionId}:${providerEventId}`;
}

export function parseImportedExternalId(externalId: string): {
  provider: "google" | "microsoft";
  connectionId: string;
  eventId: string;
} | null {
  const match = externalId.match(/^(google|microsoft):([^:]+):(.+)$/);
  if (!match) return null;
  return {
    provider: match[1] as "google" | "microsoft",
    connectionId: match[2],
    eventId: match[3],
  };
}

/** Raw provider event id for Google/Microsoft API calls. */
export function resolveProviderEventId(
  externalId: string | null,
  provider: string,
): string | null {
  if (!externalId) return null;
  if (externalId.startsWith("calendly:")) return null;
  const parsed = parseImportedExternalId(externalId);
  if (parsed?.provider === provider) return parsed.eventId;
  if (!externalId.startsWith("google:") && !externalId.startsWith("microsoft:")) {
    return externalId;
  }
  return null;
}

export function isTransovoBookedExternalId(externalId: string | null): boolean {
  if (!externalId) return false;
  return (
    !externalId.startsWith("calendly:") &&
    !externalId.startsWith("google:") &&
    !externalId.startsWith("microsoft:")
  );
}

export function shouldSyncToNativeCalendar(externalId: string | null): boolean {
  return isTransovoBookedExternalId(externalId);
}

/** Whether an appointment was created by Transovo (not calendar import). */
export function isTransovoOriginatedAppointment(metadata: unknown): boolean {
  const meta = (metadata || {}) as { source?: string };
  return meta.source === "transovo";
}
