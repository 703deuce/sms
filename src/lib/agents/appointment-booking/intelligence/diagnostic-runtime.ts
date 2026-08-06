/**
 * Diagnostic specialist — grounded failure interpretation from traces.
 */

import type { AgentExecutionTrace } from "@/lib/agents/appointment-booking/types";
import type { DiagnosticResult } from "./types";
import { compilePromptModules, DIAGNOSTIC_DEFAULT_MODULES } from "./prompt-modules";

function classifyFailureLayer(
  blockType: string,
  errorCode?: string,
  errorMessage?: string,
): DiagnosticResult["failureLayer"] {
  const hay = `${blockType} ${errorCode || ""} ${errorMessage || ""}`.toLowerCase();
  if (/timeout|rate.?limit|503|502|temporary|unavailable/.test(hay)) return "temporary";
  if (/config|missing|not.?configured|invalid.?setting/.test(hay)) return "configuration";
  if (/telnyx|calendar|provider|api|google|outlook/.test(hay)) return "provider";
  if (/validation|required|missing.?field|invalid.?phone/.test(hay)) return "data";
  if (/caller|user|abandon|hangup/.test(hay)) return "user";
  return "unknown";
}

function isRetrySafe(layer: DiagnosticResult["failureLayer"], blockType: string): boolean {
  if (layer === "temporary") return true;
  if (layer === "provider" && /timeout/.test(blockType)) return true;
  if (layer === "user" || layer === "data" || layer === "configuration") return false;
  return false;
}

export function diagnoseTrace(trace: AgentExecutionTrace): DiagnosticResult {
  const failed = [...trace.steps].reverse().find((s) => s.status === "failed");
  const toolSteps = trace.steps.filter((s) => s.blockType.startsWith("tool:"));

  if (!failed && trace.outcome !== "failed") {
    return {
      firstFailure: null,
      failureLayer: "unknown",
      retrySafe: false,
      degradedMode: false,
      affectedCalls: [trace.callId],
      ownerExplanation: `No failed step was recorded. Final outcome: ${trace.outcome.replaceAll("_", " ")}.`,
      recommendedNextAction:
        trace.outcome === "appointment_booked"
          ? "No action required — booking succeeded."
          : "Review the call transcript if the outcome seems unexpected.",
      evidenceSufficient: trace.steps.length > 0,
    };
  }

  const failureLayer = failed
    ? classifyFailureLayer(failed.blockType, failed.errorCode, failed.errorMessage)
    : "unknown";

  const detail = failed?.errorMessage || failed?.errorCode || "unknown error";
  const affectedNodeOrTool = failed?.blockType;

  const degradedMode =
    toolSteps.some((s) => s.status === "failed") && trace.outcome === "completed";

  const ownerExplanation = failed
    ? `The call failed at ${failed.blockType}. ${detail}`
    : `Call outcome is ${trace.outcome} but no explicit failed step was found — evidence may be incomplete.`;

  let recommendedNextAction = "Review the full execution trace and call recording.";
  if (failureLayer === "configuration") {
    recommendedNextAction = "Check agent settings, calendar connection, and required fields.";
  } else if (failureLayer === "provider") {
    recommendedNextAction = "Check calendar and Telnyx health; retry if temporary.";
  } else if (failureLayer === "temporary") {
    recommendedNextAction = "Safe to retry — failure appears temporary.";
  } else if (failureLayer === "data") {
    recommendedNextAction = "Review what information the caller provided and collection field rules.";
  } else if (failureLayer === "user") {
    recommendedNextAction = "Caller may have abandoned — no configuration change needed.";
  }

  return {
    firstFailure: failed
      ? {
          step: failed.blockType,
          errorCode: failed.errorCode,
          errorMessage: failed.errorMessage,
        }
      : null,
    failureLayer,
    affectedNodeOrTool,
    retrySafe: failed ? isRetrySafe(failureLayer, failed.blockType) : false,
    degradedMode,
    affectedCalls: [trace.callId],
    ownerExplanation,
    recommendedNextAction,
    evidenceSufficient: Boolean(failed || trace.steps.length > 2),
  };
}

export function formatDiagnosticForOwner(diagnosis: DiagnosticResult): string {
  const parts = [diagnosis.ownerExplanation];
  if (diagnosis.affectedNodeOrTool) {
    parts.push(`Affected: ${diagnosis.affectedNodeOrTool}.`);
  }
  parts.push(`Failure type: ${diagnosis.failureLayer}.`);
  if (diagnosis.degradedMode) {
    parts.push("Amy may have continued in degraded mode after a tool failure.");
  }
  parts.push(`Recommended next action: ${diagnosis.recommendedNextAction}`);
  if (!diagnosis.evidenceSufficient) {
    parts.push("Evidence is insufficient for a definitive root cause — more data may be needed.");
  }
  return parts.join(" ");
}

export function buildDiagnosticSystemPrompt(): string {
  return compilePromptModules({
    modules: DIAGNOSTIC_DEFAULT_MODULES,
    context: {},
  });
}
