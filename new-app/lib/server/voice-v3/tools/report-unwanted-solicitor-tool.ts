import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { voiceToolError } from "./types";
import { isReportUnwantedSolicitorAuthorized } from "./authorize-tool-for-config";

const reportUnwantedSolicitorArgsSchema = z.object({});

export type ReportUnwantedSolicitorArgs = z.infer<typeof reportUnwantedSolicitorArgsSchema>;

const REPORT_UNWANTED_SOLICITOR_DESCRIPTION = `report_unwanted_solicitor — record that this live call is a confirmed unsolicited sales solicitation.

Call exactly once when you are confident the caller is an unsolicited salesperson or marketer under the published DECLINE solicitor policy, before politely ending the call with end_call.

Do not use for legitimate customers, vendors, applicants, partners, or unclear intent. Do not use on every sales-adjacent phrase — only when the caller's primary purpose is to sell to the business.`;

export function buildReportUnwantedSolicitorOpenAiTool(_config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "report_unwanted_solicitor",
    parameters: reportUnwantedSolicitorArgsSchema,
    description: REPORT_UNWANTED_SOLICITOR_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const reportUnwantedSolicitorTool: VoiceToolDefinition<ReportUnwantedSolicitorArgs> = {
  name: "report_unwanted_solicitor",
  description: "report_unwanted_solicitor",
  parameters: {},
  validate: (raw) => reportUnwantedSolicitorArgsSchema.parse(raw),
  execute: async (ctx) => {
    const config = ctx.runtime.config;
    if (!isReportUnwantedSolicitorAuthorized(config)) {
      return voiceToolError(
        "NOT_ALLOWED",
        "Solicitor reporting is not enabled for this agent configuration.",
        { tool: "report_unwanted_solicitor" },
        "not_allowed",
      );
    }

    const workspaceId = config.workspaceId?.trim() || ctx.tenantId;
    const callId = ctx.runtime.callId;
    const snap = ctx.runtime.getSnapshot();
    const callerE164 =
      snap.shared?.phone?.trim() ||
      ctx.runtime.inboundCallerE164?.trim() ||
      null;

    const { recordVoiceV3UnwantedSolicitorOutcome } = await import(
      "../spam-protection/record-solicitor-outcome"
    );
    const result = await recordVoiceV3UnwantedSolicitorOutcome({
      workspaceId,
      callId,
      callerE164,
      displayName: snap.shared?.name?.trim() || null,
    });

    return {
      ok: true,
      outcome: "unwanted_solicitation_recorded",
      alreadyRecorded: result.alreadyRecorded,
      callerBlocked: result.callerBlocked,
      message:
        "Recorded unwanted solicitation. Politely decline and end the call with end_call when appropriate.",
    };
  },
};
