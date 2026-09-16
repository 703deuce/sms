import { getIntakeReadiness } from "../intake/readiness";
import type { IntakeFieldKey, VoiceV2IntakeState } from "../intake/types";
import type {
  VoiceV2MultichannelTranscript,
  VoiceV2PinnedIntakeSnapshot,
  VoiceV2PostCallFieldCandidate,
  VoiceV2PostCallReconcileFieldResult,
  VoiceV2PostCallReconcileOutput,
} from "./types";

function normalizeCompare(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Reconcile live intake vs post-call transcript candidates — never mutates provider actions. */
export function reconcileVoiceV2PostCallRecord(input: {
  pinned: VoiceV2PinnedIntakeSnapshot;
  transcript: VoiceV2MultichannelTranscript;
  providerLockedFields?: IntakeFieldKey[];
  candidates?: VoiceV2PostCallFieldCandidate[];
}): VoiceV2PostCallReconcileOutput {
  const locked = new Set(input.providerLockedFields || []);
  const candidates = input.candidates ?? [];

  const reconciledIntake: VoiceV2IntakeState = { ...input.pinned.intakeState };
  const fields: VoiceV2PostCallReconcileFieldResult[] = [];
  let needsReview = false;
  const now = new Date().toISOString();

  for (const cand of candidates) {
    if (locked.has(cand.fieldKey)) continue;
    const live = reconciledIntake[cand.fieldKey]?.value?.trim();
    const post = cand.candidateValue?.trim();

    if (cand.verdict === "AMBIGUOUS") {
      needsReview = true;
      fields.push({
        fieldKey: cand.fieldKey,
        liveValue: live,
        reconciledValue: live,
        verdict: "REVIEW",
      });
      continue;
    }

    if (!live && !post) {
      fields.push({ fieldKey: cand.fieldKey, verdict: "MISSING" });
      continue;
    }
    if (live && post && normalizeCompare(live, post)) {
      fields.push({
        fieldKey: cand.fieldKey,
        liveValue: live,
        reconciledValue: live,
        verdict: "MATCH",
      });
      continue;
    }
    if (!live && post && cand.verdict === "FOUND") {
      reconciledIntake[cand.fieldKey] = {
        value: post,
        status: "CAPTURED",
        source: "TRANSCRIPT_RECOVERY",
        updatedAt: now,
      };
      fields.push({
        fieldKey: cand.fieldKey,
        liveValue: live,
        reconciledValue: post,
        verdict: "CORRECT",
        provenance: "POST_CALL_RECONCILED",
      });
      continue;
    }
    if (live && post && !normalizeCompare(live, post)) {
      const threshold = cand.isExplicitCorrection ? 0.75 : 0.85;
      if (cand.confidence && cand.confidence >= threshold) {
        fields.push({
          fieldKey: cand.fieldKey,
          liveValue: live,
          reconciledValue: post,
          previousValue: live,
          verdict: "CORRECT",
          provenance: "POST_CALL_RECONCILED",
        });
        reconciledIntake[cand.fieldKey] = {
          value: post,
          status: "CORRECTED",
          source: "TRANSCRIPT_RECOVERY",
          updatedAt: now,
        };
      } else {
        needsReview = true;
        fields.push({
          fieldKey: cand.fieldKey,
          liveValue: live,
          reconciledValue: live,
          verdict: "REVIEW",
        });
      }
      continue;
    }
    if (live && !post) {
      fields.push({
        fieldKey: cand.fieldKey,
        liveValue: live,
        reconciledValue: live,
        verdict: "MATCH",
      });
    }
  }

  const readiness = getIntakeReadiness(input.pinned.intakeSchema, reconciledIntake);
  return {
    fields,
    reconciledIntake,
    recordComplete: readiness.missingForRecord.length === 0,
    missingForRecord: readiness.missingForRecord,
    needsReview,
  };
}
