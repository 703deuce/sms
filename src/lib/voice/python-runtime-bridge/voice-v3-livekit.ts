import "server-only";

import { resolveAgentByCalledNumber } from "@/lib/telephony/provisioning/agent-routing";
import { resolveVoiceV3AgentConfigForAgent } from "@/lib/voice-v3/config/from-published-agent";
import { buildVoiceV3Prompts, resolveVoiceV3DefaultPromptInput } from "@/lib/voice-v3/prompts/build-voice-v3-prompts";
import { VOICE_V3_ASTRA_MODEL } from "@/lib/voice-v3/intake/delegation-config";
import {
  VOICE_TOOL_CATALOG,
  buildVoiceV3AstraFunctionToolsFromCatalog,
  listVoiceV3AstraToolNamesForConfig,
} from "@/lib/voice-v3/tools/voice-tool-catalog";
import {
  buildLiveKitIntakeFieldMetadata,
  buildLiveKitIntakeFunctionTools,
} from "@/lib/voice-v3/tools/livekit-intake-tool-schemas";
import {
  createVoiceV3CallRuntime,
  getVoiceV3CallRuntime,
} from "@/lib/voice-v3/state/call-runtime";
import { executeVoiceTool } from "@/lib/voice-v3/tools/execute-voice-tool";
import { commitFinalCallerUtterance } from "@/lib/voice-v3/conversation/caller-turn-manager";
import { getCurrentConversationRevision } from "@/lib/voice-v3/conversation/conversation-revision";
import type { FunctionTool } from "openai/resources/live/live";

/** Tools executed natively in the LiveKit Python worker (not Astra FunctionTools). */
export const VOICE_V3_LIVEKIT_NATIVE_TOOL_NAMES = ["end_call"] as const;

/**
 * @deprecated Certification-only subset — production uses wizard capability list.
 * Kept for historical tests referencing the first PSTN cert slice.
 */
export const VOICE_V3_LIVEKIT_INITIAL_TOOL_NAMES = [
  "update_intake",
  "set_scheduling_preference",
  "find_availability",
  "request_callback",
] as const;

export type VoiceV3LiveKitBootstrapPayload = {
  roomName: string;
  sipParticipantIdentity: string;
  callerE164?: string | null;
  dialedE164?: string | null;
  sipCallId?: string | null;
  providerCallId?: string | null;
  trunkId?: string | null;
  ruleId?: string | null;
};

export type VoiceV3LiveKitSessionConfig = {
  liveSessionId: string;
  callId: string;
  workspaceId: string;
  agentId: string;
  phoneNumberId: string;
  amyInstructions: string;
  astraInstructions: string;
  astraModel: string;
  liveVoiceId: string;
  toolSchemas: FunctionTool[];
  toolNames: string[];
  intakeFields: ReturnType<typeof buildLiveKitIntakeFieldMetadata>;
  parallelToolCalls: boolean;
  maxToolSteps: number;
  reasoningEffort: "low" | "medium" | "high" | null;
  textVerbosity: "low" | "medium" | "high" | null;
};

function liveSessionIdForRoom(roomName: string): string {
  const room = roomName.trim();
  return room.startsWith("lk_") ? room : `lk_${room}`;
}

function toolSchemaName(tool: FunctionTool): string {
  if (typeof tool.name === "string") return tool.name;
  const fn = (tool as { function?: { name?: string } }).function;
  return typeof fn?.name === "string" ? fn.name : "";
}

function filterToolsForLiveKitSession(tools: FunctionTool[]): FunctionTool[] {
  const native = new Set<string>(VOICE_V3_LIVEKIT_NATIVE_TOOL_NAMES);
  return tools.filter((t) => !native.has(toolSchemaName(t)));
}

export async function resolveVoiceV3LiveKitSession(
  payload: VoiceV3LiveKitBootstrapPayload,
): Promise<VoiceV3LiveKitSessionConfig> {
  const dialed = payload.dialedE164?.trim();
  if (!dialed) {
    throw new Error("dialedE164 is required to resolve Voice V3 configuration");
  }

  const routing = await resolveAgentByCalledNumber(dialed);
  if (!routing) {
    throw new Error(`No active agent for dialed number ${dialed}`);
  }

  const agentConfig = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
  });

  const promptInput = resolveVoiceV3DefaultPromptInput(new Date(), agentConfig);
  const toolNames = listVoiceV3AstraToolNamesForConfig(agentConfig);
  const { liveInstructions, astraInstructions } = buildVoiceV3Prompts({
    ...promptInput,
    toolNames,
  });

  const liveSessionId = liveSessionIdForRoom(payload.roomName);
  const callId = liveSessionId;
  const caller = payload.callerE164?.trim() || null;

  createVoiceV3CallRuntime({
    liveSessionId,
    callId,
    inboundCallerE164: caller,
    config: agentConfig,
  });

  const catalogTools = buildVoiceV3AstraFunctionToolsFromCatalog(agentConfig);
  const intakeTools = buildLiveKitIntakeFunctionTools(agentConfig);
  const mergedByName = new Map<string, FunctionTool>();
  for (const t of filterToolsForLiveKitSession(catalogTools)) {
    mergedByName.set(toolSchemaName(t), t);
  }
  for (const t of intakeTools) {
    mergedByName.set(toolSchemaName(t), t);
  }
  const toolSchemas = [...mergedByName.values()];
  const intakeFields = buildLiveKitIntakeFieldMetadata(agentConfig);

  const liveVoiceId = agentConfig.telephony?.liveVoiceId?.trim() || "marin";

  return {
    liveSessionId,
    callId,
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    phoneNumberId: routing.phoneNumberId,
    amyInstructions: liveInstructions,
    astraInstructions,
    astraModel: VOICE_V3_ASTRA_MODEL,
    liveVoiceId,
    toolSchemas,
    toolNames: toolSchemas.map((t) => String(t.name)),
    intakeFields,
    parallelToolCalls: false,
    maxToolSteps: 5,
    reasoningEffort: "low",
    textVerbosity: "low",
  };
}

export type VoiceV3LiveKitExecuteToolPayload = {
  liveSessionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  functionCallId: string;
};

export async function executeVoiceV3ToolForLiveKit(
  payload: VoiceV3LiveKitExecuteToolPayload,
): Promise<Record<string, unknown>> {
  const liveSessionId = payload.liveSessionId.trim();
  const runtime = getVoiceV3CallRuntime(liveSessionId);
  if (!runtime) {
    return {
      ok: false,
      status: "error",
      code: "RUNTIME_NOT_FOUND",
      message: "Voice V3 call runtime not found for session",
    };
  }

  const currentRevision = getCurrentConversationRevision(liveSessionId);

  const result = await executeVoiceTool(
    {
      callId: runtime.getSnapshot().callId,
      liveSessionId,
      delegationId: null,
      functionCallId: payload.functionCallId,
      runtime,
      tenantId: runtime.config.workspaceId ?? "unknown",
      sendContext: () => {
        /* LiveKit path: no OpenAI sideband context injection */
      },
      currentConversationRevision: currentRevision,
      delegationBasedOnConversationRevision: currentRevision,
      delegationSemanticallyFresh: true,
    },
    payload.toolName,
    payload.arguments,
  );

  return result as Record<string, unknown>;
}

export function commitVoiceV3CallerUtteranceForLiveKit(input: {
  liveSessionId: string;
  utterance: string;
}): { committed: boolean; sequence: number | null; turnId: string | null } {
  const turn = commitFinalCallerUtterance(input.liveSessionId, input.utterance);
  if (!turn) {
    return { committed: false, sequence: null, turnId: null };
  }
  return { committed: true, sequence: turn.sequence, turnId: turn.turnId };
}

/** Catalog metadata for tests (no secrets). */
export function listVoiceV3LiveKitCertToolDefinitions(): string[] {
  return VOICE_TOOL_CATALOG.map((e) => e.name);
}
