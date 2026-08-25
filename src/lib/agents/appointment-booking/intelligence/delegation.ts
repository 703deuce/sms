/**
 * Specialist delegation thresholds and handoff rules.
 */

import type { AgentRuntimeId, OwnerRequestIntent } from "./types";
import { estimateContextBudget } from "./context-policy";

export type DelegationDecision = {
  delegate: boolean;
  specialist?: "appointment_workflow_architect" | "diagnostic_specialist";
  reason: string;
};

const WORKFLOW_INTENTS: OwnerRequestIntent[] = ["build_workflow"];
const DIAGNOSTIC_INTENTS: OwnerRequestIntent[] = ["diagnose_failure"];

export function evaluateDelegation(input: {
  intent: OwnerRequestIntent;
  question: string;
  traceStepCount?: number;
  dataSourceCount?: number;
  maxContextBudget?: number;
}): DelegationDecision {
  const budget = input.maxContextBudget ?? 12_000;
  const estimated = estimateContextBudget("owner_amy", input.intent);

  if (WORKFLOW_INTENTS.includes(input.intent)) {
    return {
      delegate: true,
      specialist: "appointment_workflow_architect",
      reason: "Workflow graph creation requires the Appointment Workflow Architect.",
    };
  }

  if (DIAGNOSTIC_INTENTS.includes(input.intent)) {
    return {
      delegate: true,
      specialist: "diagnostic_specialist",
      reason: "Failure interpretation requires the Diagnostic specialist.",
    };
  }

  if ((input.traceStepCount ?? 0) > 25) {
    return {
      delegate: true,
      specialist: "diagnostic_specialist",
      reason: "Execution trace exceeds Owner Amy context budget.",
    };
  }

  if ((input.dataSourceCount ?? 0) > 2) {
    return {
      delegate: true,
      specialist: undefined,
      reason: "Multiple large data sources — retrieve minimum context per source.",
    };
  }

  if (estimated > budget) {
    return {
      delegate: true,
      specialist: input.intent === "diagnose_failure" ? "diagnostic_specialist" : undefined,
      reason: `Estimated context (${estimated} tokens) exceeds budget (${budget}).`,
    };
  }

  // Complex emergency workflow described in natural language
  if (
    /\bemergency\b/i.test(input.question) &&
    /\btransfer\b/i.test(input.question) &&
    /\b(message|text|on-call)\b/i.test(input.question)
  ) {
    return {
      delegate: true,
      specialist: "appointment_workflow_architect",
      reason: "Multi-branch emergency workflow requires architect.",
    };
  }

  return { delegate: false, reason: "Owner Amy can handle directly." };
}

export function specialistRuntimeId(
  specialist: NonNullable<DelegationDecision["specialist"]>,
): AgentRuntimeId {
  return specialist;
}

/** No recursive agent-to-agent calls — Owner Amy may call at most one specialist per request. */
export const MAX_SPECIALIST_DEPTH = 1;
