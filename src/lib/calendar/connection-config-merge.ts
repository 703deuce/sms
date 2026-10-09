type DeltaLinkEntry = {
  deltaLink?: string;
  windowStart?: string;
  windowEnd?: string;
  updatedAt?: string;
};

/**
 * Deep-merge calendar connection config so concurrent syncs cannot wipe
 * `microsoftDeltaLinks` / subscription metadata written by another pass.
 */
export function mergeCalendarConnectionConfig(
  previous: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const prev = previous || {};
  const merged: Record<string, unknown> = { ...prev, ...patch };

  const prevDelta = prev.microsoftDeltaLinks as Record<string, DeltaLinkEntry> | undefined;
  const patchDelta = patch.microsoftDeltaLinks as Record<string, DeltaLinkEntry> | undefined;

  if (prevDelta || patchDelta) {
    const keys = new Set([...Object.keys(prevDelta || {}), ...Object.keys(patchDelta || {})]);
    const microsoftDeltaLinks: Record<string, DeltaLinkEntry> = {};
    for (const calendarId of keys) {
      const a = prevDelta?.[calendarId];
      const b = patchDelta?.[calendarId];
      if (!a) {
        if (b) microsoftDeltaLinks[calendarId] = b;
        continue;
      }
      if (!b) {
        microsoftDeltaLinks[calendarId] = a;
        continue;
      }
      const aTs = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const bTs = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      microsoftDeltaLinks[calendarId] = bTs >= aTs ? b : a;
    }
    merged.microsoftDeltaLinks = microsoftDeltaLinks;
  }

  if (patch.microsoftSubscription === undefined && prev.microsoftSubscription !== undefined) {
    merged.microsoftSubscription = prev.microsoftSubscription;
  }
  if (patch.googleChannelWatches === undefined && prev.googleChannelWatches !== undefined) {
    merged.googleChannelWatches = prev.googleChannelWatches;
  }

  return merged;
}
