import type { VoiceAgentConfig } from "./types";
import { extractDynamicVariables } from "./types";
import { isOutboundLeadQualificationProfile } from "./outbound/agent-config";
import {
  validateQualificationDefinition,
} from "./outbound/validate-qualification-definition";

export type ValidationIssue = {
  section: string;
  field: string;
  message: string;
  blocking: boolean;
};

export function validateAgentForPublish(
  name: string,
  config: VoiceAgentConfig,
  ctx?: { requirePhone?: boolean; phoneNumberId?: string | null },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!name?.trim()) {
    issues.push({
      section: "identity",
      field: "name",
      message: "Agent name is required",
      blocking: true,
    });
  }
  const instructions =
    config.instructions?.raw ||
    config.instructions?.system ||
    "";
  if (!instructions.trim()) {
    issues.push({
      section: "instructions",
      field: "system",
      message: "System instructions are required",
      blocking: true,
    });
  }
  if (!config.voiceLanguage?.voiceId) {
    issues.push({
      section: "voiceLanguage",
      field: "voiceId",
      message: "Voice selection is required",
      blocking: true,
    });
  }
  if (!config.model?.modelId) {
    issues.push({
      section: "model",
      field: "modelId",
      message: "Model selection is required",
      blocking: true,
    });
  }
  if (ctx?.requirePhone && !ctx.phoneNumberId) {
    issues.push({
      section: "identity",
      field: "phoneNumberId",
      message: "A default phone number is required for inbound agents",
      blocking: true,
    });
  }
  const allText = [
    instructions,
    config.instructions?.goals || "",
    JSON.stringify(config.conversationFlow || {}),
  ].join(" ");
  const vars = extractDynamicVariables(allText);
  for (const v of vars) {
    if (v.includes(" ") || v.length > 64) {
      issues.push({
        section: "instructions",
        field: "variables",
        message: `Invalid dynamic variable: {{${v}}}`,
        blocking: true,
      });
    }
  }

  if (isOutboundLeadQualificationProfile(config)) {
    const qualIssues = validateQualificationDefinition(config.advanced?.outboundQualification);
    for (const issue of qualIssues) {
      issues.push({
        section: "outboundQualification",
        field: issue.path,
        message: issue.message,
        blocking: true,
      });
    }
  }

  return issues;
}

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.blocking);
}
