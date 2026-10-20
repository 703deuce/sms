"use client";

import type { WizardStepId } from "../types";
import { flattenWizardState, stableJsonEqual } from "./flatten";
import { isReceptionistUiTraceEnabled } from "./flags";
import { redactFieldValue } from "./redact";

export function logReceptionistUiChanges(input: {
  stepId: WizardStepId | undefined;
  previous: Record<string, unknown>;
  patch: Record<string, unknown>;
  traceId?: string;
}): void {
  if (!isReceptionistUiTraceEnabled()) return;
  const prevFlat = flattenWizardState(input.previous);
  const nextFlat = flattenWizardState({ ...input.previous, ...input.patch });
  for (const path of Object.keys(nextFlat)) {
    if (!stableJsonEqual(prevFlat[path], nextFlat[path])) {
      const line = `[RECEPTIONIST][UI_CHANGE]\nstep=${input.stepId ?? "unknown"}\nfield=${path}\nprevious=${JSON.stringify(redactFieldValue(path, prevFlat[path]))}\nnext=${JSON.stringify(redactFieldValue(path, nextFlat[path]))}\ndirty=true${input.traceId ? `\ntrace=${input.traceId}` : ""}`;
      console.info(line);
    }
  }
}
