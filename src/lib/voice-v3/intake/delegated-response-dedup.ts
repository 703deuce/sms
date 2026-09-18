const processedBySession = new Map<string, Set<string>>();
const lastMeaningFingerprint = new Map<string, { fingerprint: string; atMs: number }>();
const MEANING_FINGERPRINT_WINDOW_MS = 4_000;

function sessionSet(sessionId: string): Set<string> {
  let set = processedBySession.get(sessionId);
  if (!set) {
    set = new Set();
    processedBySession.set(sessionId, set);
  }
  return set;
}

/**
 * Stable id for one delegated Astra response (shared across output_item.done + response.completed).
 */
export function extractDelegatedAstraResponseId(
  nested: Record<string, unknown>,
): string | null {
  const nestedType = String(nested.type || "");
  if (nestedType === "response.function_call_arguments.done") {
    const responseId = nested.response_id;
    if (typeof responseId === "string" && responseId.trim()) return responseId.trim();
  }

  const response = nested.response;
  if (response && typeof response === "object") {
    const id = (response as Record<string, unknown>).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }

  const item = nested.item;
  if (item && typeof item === "object") {
    const responseId = (item as Record<string, unknown>).response_id;
    if (typeof responseId === "string" && responseId.trim()) return responseId.trim();
  }

  return null;
}

/**
 * @returns true if this delegated response should be processed (first time for this session).
 */
export function claimDelegatedAstraResponse(
  liveSessionId: string,
  nested: Record<string, unknown>,
): boolean {
  const sessionId = liveSessionId.trim();
  if (!sessionId) return false;

  const responseId = extractDelegatedAstraResponseId(nested);
  const dedupKey = responseId ?? `event:${String(nested.type || "")}:${String(nested.event_id || nested.id || "")}`;
  if (!dedupKey) return true;

  const set = sessionSet(sessionId);
  if (set.has(dedupKey)) {
    console.log("ASTRA_MEANING_DEDUP_SKIPPED", {
      live_session_id: sessionId,
      dedup_key: dedupKey,
      nested_type: nested.type,
    });
    return false;
  }
  set.add(dedupKey);
  return true;
}

/**
 * Guards duplicate completion events that carry the same CallerMeaning payload.
 */
export function claimCallerMeaningFingerprint(
  liveSessionId: string,
  meaningFingerprint: string,
): boolean {
  const sessionId = liveSessionId.trim();
  if (!sessionId || !meaningFingerprint) return true;

  const now = Date.now();
  const prev = lastMeaningFingerprint.get(sessionId);
  if (
    prev &&
    prev.fingerprint === meaningFingerprint &&
    now - prev.atMs < MEANING_FINGERPRINT_WINDOW_MS
  ) {
    console.log("ASTRA_MEANING_FINGERPRINT_DEDUP_SKIPPED", {
      live_session_id: sessionId,
    });
    return false;
  }
  lastMeaningFingerprint.set(sessionId, { fingerprint: meaningFingerprint, atMs: now });
  return true;
}

export function clearDelegatedAstraResponseDedup(liveSessionId: string): void {
  processedBySession.delete(liveSessionId.trim());
  lastMeaningFingerprint.delete(liveSessionId.trim());
}

/** After semantic retry applies meaning, block duplicate processing of the same delegated response. */
export function markDelegatedAstraResponseProcessed(
  liveSessionId: string,
  responseId: string,
): void {
  const sessionId = liveSessionId.trim();
  const id = responseId.trim();
  if (!sessionId || !id) return;
  sessionSet(sessionId).add(id);
}
