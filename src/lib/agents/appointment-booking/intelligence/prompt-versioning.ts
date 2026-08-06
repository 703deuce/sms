/**
 * Prompt versioning — hash, deployment metadata, regression tracking.
 */

import { createHash } from "crypto";
import type { AgentRuntimeId, PromptVersionRecord } from "./types";
import {
  compilePromptModules,
  OWNER_AMY_DEFAULT_MODULES,
  CALLER_AMY_DEFAULT_MODULES,
  WORKFLOW_ARCHITECT_DEFAULT_MODULES,
  DIAGNOSTIC_DEFAULT_MODULES,
} from "./prompt-modules";
import { buildWorkflowArchitectSystemPrompt } from "./workflow-architect-runtime";
import { buildDiagnosticSystemPrompt } from "./diagnostic-runtime";

const PROMPT_VERSION = "2026.08.06.1";
const TOOL_SCHEMA_VERSION = "1.0.0";

function hashPrompt(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function sampleOwnerPrompt(): string {
  return compilePromptModules({
    modules: OWNER_AMY_DEFAULT_MODULES,
    context: {
      agentName: "{{agent_name}}",
      businessName: "{{business_name}}",
      workspaceId: "{{workspace_id}}",
      agentVersionId: "{{agent_version_id}}",
      localDateTime: "{{local_datetime}}",
      timezone: "{{timezone}}",
      userPermissionLevel: "owner",
      agentType: "appointment_booking",
    },
  });
}

const RUNTIME_PROMPT_BUILDERS: Record<AgentRuntimeId, () => string> = {
  owner_amy: sampleOwnerPrompt,
  caller_amy: () =>
    compilePromptModules({
      modules: CALLER_AMY_DEFAULT_MODULES,
      context: { agentName: "{{agent_name}}", businessName: "{{business_name}}" },
    }),
  appointment_workflow_architect: buildWorkflowArchitectSystemPrompt,
  diagnostic_specialist: buildDiagnosticSystemPrompt,
};

export function getPromptVersionRecord(runtimeId: AgentRuntimeId): PromptVersionRecord {
  const prompt = RUNTIME_PROMPT_BUILDERS[runtimeId]();
  return {
    runtimeId,
    promptVersion: PROMPT_VERSION,
    hash: hashPrompt(prompt),
    deployedAt: "2026-08-06T00:00:00.000Z",
    model:
      runtimeId === "caller_amy"
        ? "telnyx:anthropic/claude-haiku-4-5"
        : "internal:deterministic",
    toolSchemaVersion: TOOL_SCHEMA_VERSION,
    regressionSuiteResult: "pending",
  };
}

export function getAllPromptVersions(): PromptVersionRecord[] {
  return (
    [
      "owner_amy",
      "caller_amy",
      "appointment_workflow_architect",
      "diagnostic_specialist",
    ] as AgentRuntimeId[]
  ).map(getPromptVersionRecord);
}

export function hashPromptText(text: string): string {
  return hashPrompt(text);
}

export { PROMPT_VERSION, TOOL_SCHEMA_VERSION };
