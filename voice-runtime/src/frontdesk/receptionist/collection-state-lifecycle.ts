import type { ReceptionistCollectionPurpose } from "./workflow-types";
import type { FrontDeskUserData } from "../userdata";
import {
  ensureReceptionistWorkflow,
  missingFieldsForPurpose,
} from "./workflow-engine";

/** Runtime collection substates — derived from phase, not loose booleans. */
export type CollectionFieldPhase = "PROMPTING" | "LISTENING" | "PROCESSING";

export function collectionStateSnapshot(ud: FrontDeskUserData): Record<string, unknown> {
  const wf = ensureReceptionistWorkflow(ud);
  const purpose = wf.collectionPurpose || "booking";
  const completed = Object.keys(ud.receptionistFields || {}).filter((id) =>
    Boolean(ud.receptionistFields?.[id]?.trim()),
  );
  const missing = missingFieldsForPurpose(ud, purpose).map((f) => f.id);
  return {
    state: wf.state,
    activeFieldId: wf.activeFieldId,
    collectionFieldPhase: ud.collectionFieldPhase,
    collectionPromptedFieldId: ud.collectionPromptedFieldId,
    completedFields: completed,
    missingRequiredFields: missing,
  };
}

export function logCollectionState(
  callId: string,
  reason: string,
  ud: FrontDeskUserData,
  extra?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      source: "collection-state",
      event: "collection_state",
      reason,
      callId,
      ...collectionStateSnapshot(ud),
      ...extra,
    }),
  );
}

/** Set active field and phase before speaking the prompt. */
export function beginCollectionPrompt(ud: FrontDeskUserData, fieldId: string): void {
  const wf = ensureReceptionistWorkflow(ud);
  wf.activeFieldId = fieldId;
  ud.collectionFieldPhase = "PROMPTING";
  ud.collectionPromptedFieldId = fieldId;
}

/** Caller may answer — activeFieldId is authoritative. */
export function finishCollectionPrompt(ud: FrontDeskUserData, fieldId: string): void {
  const wf = ensureReceptionistWorkflow(ud);
  wf.activeFieldId = fieldId;
  ud.collectionFieldPhase = "LISTENING";
  ud.collectionPromptedFieldId = fieldId;
}

export function markCollectionProcessing(ud: FrontDeskUserData): void {
  ud.collectionFieldPhase = "PROCESSING";
}

export function clearCollectionPromptState(ud: FrontDeskUserData): void {
  ud.collectionFieldPhase = undefined;
  ud.collectionPromptedFieldId = undefined;
}

export function isCollectionListening(ud: FrontDeskUserData): boolean {
  return ud.collectionFieldPhase === "LISTENING" || ud.collectionFieldPhase === "PROMPTING";
}
