/**
 * Per-call guard: stale utterance revisions must not merge after a newer stable revision.
 */

import type { StableCallerUtterance } from "./live-caller-utterance-assembler";

type UtteranceTrack = {
  utteranceId: string;
  latestStableRevision: number;
  latestAppliedRevision: number;
  inFlightRevision: number | null;
};

const tracks = new Map<string, UtteranceTrack>();

function trackKey(callId: string): string {
  return callId;
}

export function registerStableCallerUtterance(callId: string, stable: StableCallerUtterance): void {
  const key = trackKey(callId);
  const existing = tracks.get(key);
  if (!existing || existing.utteranceId !== stable.utterance_id) {
    tracks.set(key, {
      utteranceId: stable.utterance_id,
      latestStableRevision: stable.revision,
      latestAppliedRevision: -1,
      inFlightRevision: null,
    });
    return;
  }
  existing.latestStableRevision = Math.max(existing.latestStableRevision, stable.revision);
}

export function beginUtteranceInterpretation(
  callId: string,
  stable: StableCallerUtterance,
): boolean {
  const key = trackKey(callId);
  const track = tracks.get(key);
  if (!track || track.utteranceId !== stable.utterance_id) {
    registerStableCallerUtterance(callId, stable);
  }
  const t = tracks.get(key)!;
  if (stable.revision < t.latestStableRevision) {
    return false;
  }
  t.inFlightRevision = stable.revision;
  return true;
}

export function shouldApplyUtteranceInterpretation(
  callId: string,
  stable: StableCallerUtterance,
): boolean {
  const key = trackKey(callId);
  const track = tracks.get(key);
  if (!track || track.utteranceId !== stable.utterance_id) {
    return true;
  }
  if (stable.revision < track.latestStableRevision) {
    return false;
  }
  if (stable.revision <= track.latestAppliedRevision) {
    return false;
  }
  return true;
}

export function markUtteranceInterpretationApplied(
  callId: string,
  stable: StableCallerUtterance,
): void {
  const key = trackKey(callId);
  const track = tracks.get(key);
  if (!track || track.utteranceId !== stable.utterance_id) return;
  track.latestAppliedRevision = Math.max(track.latestAppliedRevision, stable.revision);
  if (track.inFlightRevision === stable.revision) {
    track.inFlightRevision = null;
  }
}

export function clearUtteranceRevisionGuard(callId: string): void {
  tracks.delete(trackKey(callId));
}

/** Test isolation */
export function resetAllUtteranceRevisionGuards(): void {
  tracks.clear();
}
