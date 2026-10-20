import type { AppointmentReceptionistWizardState, WizardStepId } from "../types";
import { wizardStepOwnedFields } from "../merge-wizard-state-on-save";
import { diffWizardStates } from "./diff";
import { receptionistFieldDiffLog } from "./log";

export type MergeFieldOutcome =
  | "accepted"
  | "rejected_ownership"
  | "unchanged"
  | "normalized"
  | "guardrail_forced";

export type MergeTraceResult = {
  submittedPaths: string[];
  changedPaths: string[];
  unchangedPaths: string[];
  rejectedPaths: string[];
  guardrailForcedPaths: string[];
  outcomes: Array<{ path: string; outcome: MergeFieldOutcome; previous: unknown; incoming: unknown; result: unknown }>;
};

export function analyzeMergeTrace(input: {
  traceId: string;
  server: AppointmentReceptionistWizardState;
  incoming: AppointmentReceptionistWizardState;
  merged: AppointmentReceptionistWizardState;
  stepId?: WizardStepId | null;
  beforeGuardrails?: AppointmentReceptionistWizardState;
  afterGuardrails?: AppointmentReceptionistWizardState;
}): MergeTraceResult {
  const owned = new Set(
    input.stepId ? wizardStepOwnedFields(input.stepId).map(String) : null,
  );
  const incomingDiff = diffWizardStates(input.server, input.incoming);
  const mergedDiff = diffWizardStates(input.server, input.merged);

  const submittedPaths = incomingDiff.changed;
  const changedPaths = mergedDiff.changed;
  const unchangedPaths = mergedDiff.unchanged;
  const rejectedPaths: string[] = [];
  const guardrailForcedPaths: string[] = [];
  const outcomes: MergeTraceResult["outcomes"] = [];

  if (input.stepId && owned.size) {
    for (const path of incomingDiff.changed) {
      const leaf = path.split(".").pop() ?? path;
      if (!owned.has(leaf)) {
        rejectedPaths.push(path);
        outcomes.push({
          path,
          outcome: "rejected_ownership",
          previous: mergedDiff.entries.find((e) => e.path === path)?.before,
          incoming: incomingDiff.entries.find((e) => e.path === path)?.after,
          result: mergedDiff.entries.find((e) => e.path === path)?.after,
        });
        receptionistFieldDiffLog(input.traceId, "MERGE", {
          path,
          before: mergedDiff.entries.find((e) => e.path === path)?.before,
          after: mergedDiff.entries.find((e) => e.path === path)?.after,
          reason: "rejected_ownership",
        });
      }
    }
  }

  if (input.beforeGuardrails && input.afterGuardrails) {
    const gDiff = diffWizardStates(input.beforeGuardrails, input.afterGuardrails);
    for (const path of gDiff.changed) {
      guardrailForcedPaths.push(path);
      outcomes.push({
        path,
        outcome: "guardrail_forced",
        previous: gDiff.entries.find((e) => e.path === path)?.before,
        incoming: gDiff.entries.find((e) => e.path === path)?.after,
        result: gDiff.entries.find((e) => e.path === path)?.after,
      });
    }
  }

  for (const path of changedPaths) {
    if (rejectedPaths.includes(path) || guardrailForcedPaths.includes(path)) continue;
    outcomes.push({
      path,
      outcome: "accepted",
      previous: mergedDiff.entries.find((e) => e.path === path)?.before,
      incoming: incomingDiff.entries.find((e) => e.path === path)?.after,
      result: mergedDiff.entries.find((e) => e.path === path)?.after,
    });
    receptionistFieldDiffLog(input.traceId, "MERGE", {
      path,
      before: mergedDiff.entries.find((e) => e.path === path)?.before,
      after: mergedDiff.entries.find((e) => e.path === path)?.after,
      reason: "accepted",
    });
  }

  return {
    submittedPaths,
    changedPaths,
    unchangedPaths,
    rejectedPaths,
    guardrailForcedPaths,
    outcomes,
  };
}
