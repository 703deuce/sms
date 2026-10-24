import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceToolDefinition } from "./types";
import { toolOk, voiceToolError } from "./types";
import { TRANSFER_CALL_TOOL_DESCRIPTION } from "./astra-tool-contracts";
import { authorizeVoiceV3ToolOrError } from "./authorize-tool-for-config";
import {
  authorizeVoiceV3Transfer,
  type TransferCallArgs,
} from "../transfer/authorize-transfer";
import { logVoiceV3TransferEvent } from "../transfer/telemetry";
import { ensurePhoneFoundationForTransfer } from "../transfer/ensure-phone-foundation";
import { mergeDialogActiveGoalFromOperation } from "../intake/merge-intake-state";

function catalogForSchema(config: VoiceV3AgentConfig) {
  const policy = config.transfer;
  const routeIds = policy?.routes?.map((r) => r.id).filter(Boolean) ?? [];
  const destIds =
    policy?.destinations?.map((d) => d.id).filter(Boolean) ??
    config.transferDestinations?.map((d) => d.id).filter(Boolean) ??
    [];
  return { routeIds, destIds };
}

function buildTransferArgsSchema(config: VoiceV3AgentConfig) {
  const { routeIds, destIds } = catalogForSchema(config);

  const routeSchema =
    routeIds.length > 0
      ? z
          .enum(routeIds as [string, ...string[]])
          .nullable()
          .describe(
            `Authorized transfer route id. Allowed: ${routeIds.join(", ")}. Null when only one route applies.`,
          )
      : z
          .string()
          .nullable()
          .describe("Authorized transfer route id. Null when only one route is configured.");

  const destinationSchema =
    destIds.length > 0
      ? z
          .enum(destIds as [string, ...string[]])
          .nullable()
          .describe(
            `Specific authorized destination id when the caller names a configured person or department. Allowed: ${destIds.join(", ")}.`,
          )
      : z
          .string()
          .nullable()
          .describe("Authorized destination id when the caller requests a specific configured destination.");

  return z.object({
    route_id: routeSchema,
    destination_id: destinationSchema,
    reason: z
      .string()
      .nullable()
      .describe("Brief reason for transfer for logging and human handoff context."),
    /** @deprecated — use destination_id */
    destination: destinationSchema,
  });
}

const looseTransferArgsSchema = z.object({
  route_id: z.string().nullable().optional(),
  destination_id: z.string().nullable().optional(),
  destination: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});

export function buildTransferCallOpenAiTool(config: VoiceV3AgentConfig): FunctionTool {
  const zodTool = zodResponsesFunction({
    name: "transfer_call",
    parameters: buildTransferArgsSchema(config),
    description: TRANSFER_CALL_TOOL_DESCRIPTION,
  });
  return {
    type: "function",
    name: zodTool.name,
    description: zodTool.description ?? null,
    parameters: zodTool.parameters as Record<string, unknown>,
    strict: true,
  };
}

export const transferCallTool: VoiceToolDefinition<TransferCallArgs> = {
  name: "transfer_call",
  description: "transfer_call",
  parameters: {},
  validate: (raw) => {
    const parsed = looseTransferArgsSchema.parse(raw);
    return {
      route_id: parsed.route_id ?? null,
      destination_id: parsed.destination_id ?? parsed.destination ?? null,
      destination: parsed.destination ?? parsed.destination_id ?? null,
      reason: parsed.reason ?? null,
    };
  },
  execute: async (ctx, args) => {
    const config = ctx.runtime.config;
    const denied = authorizeVoiceV3ToolOrError(config, "transfer_call");
    if (denied) return denied;

    const strict = buildTransferArgsSchema(config).safeParse({
      route_id: args.route_id,
      destination_id: args.destination_id ?? args.destination,
      destination: args.destination,
      reason: args.reason,
    });
    if (!strict.success) {
      return voiceToolError(
        "INVALID_ARGUMENTS",
        "Transfer arguments are invalid.",
        { issues: strict.error.issues.map((i) => i.message) },
      );
    }

    const policy = config.transfer;
    if (!policy?.enabled) {
      return voiceToolError(
        "TRANSFER_NOT_CONFIGURED",
        "Human transfer is not configured for this workspace.",
        {},
        "not_ready",
      );
    }

    let snap = mergeDialogActiveGoalFromOperation(ctx.runtime.getSnapshot(), "transfer_call");
    ctx.runtime.replaceContext(snap);

    logVoiceV3TransferEvent("VOICE_V3_TRANSFER_REQUESTED", {
      call_id: ctx.callId,
      live_session_id: ctx.liveSessionId,
      route_id: strict.data.route_id,
      destination_id: strict.data.destination_id,
      reason: strict.data.reason,
    });

    const workspaceId = config.workspaceId?.trim();
    if (!workspaceId) {
      return voiceToolError(
        "CONFIGURATION_ERROR",
        "Workspace is not available for transfer.",
        {},
        "not_ready",
      );
    }

    const callContext = await ensurePhoneFoundationForTransfer({
      runtime: ctx.runtime,
      workspaceId,
    });

    const authorized = authorizeVoiceV3Transfer({
      config,
      policy,
      callContext,
      args: strict.data,
    });
    if (!authorized.ok) return authorized;

    const { execution, surface } = authorized.data as {
      execution: Record<string, unknown>;
      surface: Record<string, unknown>;
    };

    return toolOk("transfer_authorized", {
      ...surface,
      execution,
    });
  },
};
