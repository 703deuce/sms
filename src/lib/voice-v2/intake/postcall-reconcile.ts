import "server-only";

import type { IntakeFieldKey, IntakeFieldValue, VoiceV2IntakeState } from "./types";

/**
 * DEFER_AFTER_CALL — constrained transcript backfill (no booking changes).
 * Invoked from post-call hooks; not on caller-critical path.
 */
export type PostCallReconcileCandidate = {
  value: string;
  evidence_turn: string;
  confidence: number;
};

export type PostCallReconcileResult = {
  candidate_backfills: Partial<Record<IntakeFieldKey, PostCallReconcileCandidate>>;
};

const EMAIL_RE = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;

function canonicalState(state: VoiceV2IntakeState): VoiceV2IntakeState {
  return state || {};
}

function fieldIsMissing(key: IntakeFieldKey, state: VoiceV2IntakeState): boolean {
  const row = state[key];
  if (!row?.value?.trim()) return true;
  if (row.status === "MISSING") return true;
  return false;
}

function mustNotOverwrite(key: IntakeFieldKey, state: VoiceV2IntakeState): boolean {
  const row = state[key];
  if (!row?.value?.trim()) return false;
  return row.status === "CORRECTED" || row.status === "CAPTURED" || row.status === "CONFIRMED";
}

/** Conservative transcript scan — post-call only; never overwrites canonical captured values. */
export function extractPostCallIntakeCandidates(
  transcript: string,
  canonicalIntake: VoiceV2IntakeState,
): PostCallReconcileResult {
  const state = canonicalState(canonicalIntake);
  const candidate_backfills: PostCallReconcileResult["candidate_backfills"] = {};
  const lines = transcript.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (fieldIsMissing("email", state) && !candidate_backfills.email) {
      const matches = [...line.matchAll(EMAIL_RE)];
      if (matches.length) {
        const value = matches[matches.length - 1]![1]!.toLowerCase();
        candidate_backfills.email = {
          value,
          evidence_turn: line.slice(0, 240),
          confidence: 0.85,
        };
      }
    }
  }

  return { candidate_backfills };
}

export function mergePostCallBackfills(
  canonicalIntake: VoiceV2IntakeState,
  candidates: PostCallReconcileResult,
): VoiceV2IntakeState {
  const next: VoiceV2IntakeState = { ...canonicalIntake };
  const now = new Date().toISOString();
  for (const key of Object.keys(candidates.candidate_backfills) as IntakeFieldKey[]) {
    const cand = candidates.candidate_backfills[key];
    if (!cand?.value?.trim()) continue;
    if (mustNotOverwrite(key, next)) continue;
    if (!fieldIsMissing(key, next)) continue;
    next[key] = {
      value: cand.value.trim(),
      status: "CAPTURED",
      source: "TRANSCRIPT_RECOVERY",
      updatedAt: now,
    };
  }
  return next;
}

export async function runVoiceV2PostCallIntakeReconciliation(input: {
  workspaceId: string;
  voiceCallId: string;
  transcript: string;
  canonicalIntake: VoiceV2IntakeState;
}): Promise<PostCallReconcileResult> {
  return extractPostCallIntakeCandidates(input.transcript, input.canonicalIntake);
}
