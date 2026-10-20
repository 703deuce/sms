/**
 * Conversational evidence from Live transcript fragments (not authoritative business state).
 */

export type TranscriptFragment = {
  text: string;
  receivedAt: number;
};

export type TranscriptAccumulatorState = {
  callerFragments: TranscriptFragment[];
  assistantFragments: TranscriptFragment[];
  rollingCallerText: string;
  lastCallerDeltaAt?: number;
};

const MAX_FRAGMENTS = 200;

const accumulators = new Map<string, TranscriptAccumulatorState>();

function row(liveSessionId: string): TranscriptAccumulatorState {
  const id = liveSessionId.trim();
  let r = accumulators.get(id);
  if (!r) {
    r = { callerFragments: [], assistantFragments: [], rollingCallerText: "" };
    accumulators.set(id, r);
  }
  return r;
}

function trimFragments(fragments: TranscriptFragment[]): void {
  if (fragments.length > MAX_FRAGMENTS) {
    fragments.splice(0, fragments.length - MAX_FRAGMENTS);
  }
}

export function appendCallerTranscriptFragment(liveSessionId: string, delta: string): void {
  const id = liveSessionId.trim();
  if (!id || !delta) return;
  const r = row(id);
  const now = Date.now();
  r.callerFragments.push({ text: delta, receivedAt: now });
  trimFragments(r.callerFragments);
  r.rollingCallerText = `${r.rollingCallerText}${delta}`;
  r.lastCallerDeltaAt = now;
}

export function appendAssistantTranscriptFragment(liveSessionId: string, delta: string): void {
  const id = liveSessionId.trim();
  if (!id || !delta) return;
  const r = row(id);
  r.assistantFragments.push({ text: delta, receivedAt: Date.now() });
  trimFragments(r.assistantFragments);
}

/** Merge committed segment into rolling history (post-turn commit). */
export function commitCallerTranscriptSegment(liveSessionId: string, segment: string): string {
  const id = liveSessionId.trim();
  const trimmed = segment.trim();
  const r = row(id);
  if (trimmed) {
    r.rollingCallerText = r.rollingCallerText.trim()
      ? `${r.rollingCallerText.trim()} ${trimmed}`.trim()
      : trimmed;
  }
  return r.rollingCallerText;
}

export function getRollingCallerTranscript(liveSessionId: string): string {
  return row(liveSessionId).rollingCallerText.trim();
}

export function getLastCallerTranscriptActivityAt(liveSessionId: string): number | undefined {
  return row(liveSessionId).lastCallerDeltaAt;
}

export function clearTranscriptAccumulator(liveSessionId: string): void {
  accumulators.delete(liveSessionId.trim());
}
