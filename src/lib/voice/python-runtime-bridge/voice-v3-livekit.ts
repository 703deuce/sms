import "server-only";

import { resolveAgentByCalledNumber } from "@/lib/telephony/provisioning/agent-routing";
import { resolveVoiceV3AgentConfigForAgent } from "@/lib/voice-v3/config/from-published-agent";
import { buildVoiceV3Prompts, resolveVoiceV3DefaultPromptInput } from "@/lib/voice-v3/prompts/build-voice-v3-prompts";
import {
  VOICE_V3_ASTRA_MODEL,
  VOICE_V3_ASTRA_REASONING_EFFORT,
  logVoiceV3AstraModelOnce,
} from "@/lib/voice-v3/intake/delegation-config";
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
import {
  appendVoiceV3ForensicEvent,
  initVoiceV3CallForensics,
  mergeCanonicalConversationTurn,
} from "@/lib/voice-v3/telemetry/call-forensics";
import { ensureVoiceV3LiveKitVoiceCall } from "@/lib/voice/python-runtime-bridge/ensure-voice-v3-livekit-voice-call";
import {
  attachLiveContextEventsToToolResult,
  createVoiceV3LiveKitLiveContextCollector,
  resolveVoiceV3DelegatedRuntimeContextForLiveKit,
} from "@/lib/voice/python-runtime-bridge/voice-v3-livekit-live-context";
import type { FunctionTool } from "openai/resources/live/live";
import type { VoiceV3AgentConfig } from "@/lib/voice-v3/config/agent-config";

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
  /** LiveKit SIP participant attribute from Telnyx X-Telnyx-Call-Screening header mapping */
  telnyxCallScreeningRaw?: string | null;
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
  reasoningEffort: "none" | "low" | "medium" | "high" | null;
  textVerbosity: "low" | "medium" | "high" | null;
  /** OpenAI vector stores for LiveKit GPT-Live FileSearch provider tool. */
  openaiFileSearchVectorStoreIds: string[];
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

/** Vector store IDs passed to the Python worker for native FileSearch (cert-tested). */
export function resolveOpenAiFileSearchVectorStoreIdsForSession(
  agentConfig: VoiceV3AgentConfig,
): string[] {
  if (agentConfig.knowledge?.retrieval?.enabled !== true) return [];
  return (agentConfig.knowledge.retrieval.openaiVectorStoreIds ?? []).filter(Boolean);
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
    console.error(
      JSON.stringify({
        event: "voice_v3_livekit_session_resolve_failed",
        reason: "no_inbound_agent_for_dialed_number",
        dialedE164: dialed,
        roomName: payload.roomName,
      }),
    );
    throw new Error(`No active agent for dialed number ${dialed}`);
  }

  console.log(
    JSON.stringify({
      event: "voice_v3_livekit_session_resolve",
      dialedE164: dialed,
      workspaceId: routing.workspaceId,
      agentId: routing.agentId,
      phoneNumberId: routing.phoneNumberId,
      roomName: payload.roomName,
    }),
  );

  const agentConfig = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
  });

  const caller = payload.callerE164?.trim() || null;
  if (caller) {
    const { isCallerBlockedForWorkspace } = await import("@/lib/voice-v3/spam-protection/blocklist");
    const blocked = await isCallerBlockedForWorkspace({
      workspaceId: routing.workspaceId,
      callerE164: caller,
    });
    if (blocked) {
      throw new Error("caller_blocked_for_workspace");
    }
  }

  const { normalizeTelnyxScreeningValue } = await import("@/lib/voice-v3/spam-protection/types");
  const carrierScreeningRaw = payload.telnyxCallScreeningRaw?.trim() || null;
  const carrierScreeningNormalized = normalizeTelnyxScreeningValue(carrierScreeningRaw);
  const suspectedSpamLikely = carrierScreeningNormalized === "spam_likely";

  const promptInput = resolveVoiceV3DefaultPromptInput(new Date(), agentConfig);
  const nativeAmy = new Set<string>(VOICE_V3_LIVEKIT_NATIVE_TOOL_NAMES);
  const astraDelegationToolNames = listVoiceV3AstraToolNamesForConfig(agentConfig).filter(
    (n) => !nativeAmy.has(n),
  );
  const { liveInstructions, astraInstructions } = buildVoiceV3Prompts({
    ...promptInput,
    toolNames: astraDelegationToolNames,
    suspectedSpamLikely,
  });

  const liveSessionId = liveSessionIdForRoom(payload.roomName);
  const callId = liveSessionId;

  createVoiceV3CallRuntime({
    liveSessionId,
    callId,
    inboundCallerE164: caller,
    config: agentConfig,
  });

  await ensureVoiceV3LiveKitVoiceCall({
    callId,
    liveSessionId,
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    phoneNumberId: routing.phoneNumberId,
    fromE164: caller,
    toE164: dialed,
    roomName: payload.roomName,
    sipParticipantIdentity: payload.sipParticipantIdentity,
  }).catch((err) => {
    console.error("VOICE_V3_ENSURE_LIVEKIT_CALL_FAILED", {
      callId,
      liveSessionId,
      message: err instanceof Error ? err.message : String(err),
    });
  });

  initVoiceV3CallForensics({
    callId,
    liveSessionId,
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
  });

  if (carrierScreeningRaw) {
    const { mergeVoiceV3ScreeningOnCall } = await import(
      "@/lib/voice-v3/spam-protection/call-metadata"
    );
    await mergeVoiceV3ScreeningOnCall({
      workspaceId: routing.workspaceId,
      callId,
      patch: {
        carrierScreeningRaw,
        carrierScreeningNormalized,
        suspectedSpamLikely,
        spamLikelyPolicy: agentConfig.spamProtection?.spamLikelyPolicy ?? null,
        classifiedAt: new Date().toISOString(),
      },
    }).catch((err) => {
      console.warn("VOICE_V3_SCREENING_METADATA_MERGE_FAILED", {
        callId,
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }

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

  logVoiceV3AstraModelOnce();
  appendVoiceV3ForensicEvent(liveSessionId, "VOICE_V3_SESSION_BOOTSTRAP_START", {
    room_name: payload.roomName,
    dialed_e164: dialed,
    caller_present: Boolean(caller),
    backend_model: VOICE_V3_ASTRA_MODEL,
    live_voice_id: liveVoiceId,
  });
  appendVoiceV3ForensicEvent(liveSessionId, "VOICE_V3_SESSION_CONFIG_RESOLVED", {
    tool_count: toolSchemas.length,
  });

  const openaiFileSearchVectorStoreIds =
    resolveOpenAiFileSearchVectorStoreIdsForSession(agentConfig);

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
    reasoningEffort: VOICE_V3_ASTRA_REASONING_EFFORT,
    textVerbosity: "low",
    openaiFileSearchVectorStoreIds,
  };
}

export type VoiceV3LiveKitExecuteToolPayload = {
  liveSessionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  functionCallId: string;
  delegationId?: string | null;
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
  const toolStarted = Date.now();
  const liveContext = createVoiceV3LiveKitLiveContextCollector();
  appendVoiceV3ForensicEvent(liveSessionId, "NODE_TOOL_EXECUTION_STARTED", {
    tool_name: payload.toolName,
    function_call_id: payload.functionCallId,
  });

  const result = await executeVoiceTool(
    {
      callId: runtime.getSnapshot().callId,
      liveSessionId,
      delegationId: payload.delegationId?.trim() || null,
      functionCallId: payload.functionCallId,
      runtime,
      tenantId: runtime.config.workspaceId ?? "unknown",
      sendContext: liveContext.sendContext,
      currentConversationRevision: currentRevision,
      delegationBasedOnConversationRevision: currentRevision,
      delegationSemanticallyFresh: true,
    },
    payload.toolName,
    payload.arguments,
  );

  appendVoiceV3ForensicEvent(liveSessionId, "NODE_TOOL_EXECUTION_COMPLETED", {
    tool_name: payload.toolName,
    function_call_id: payload.functionCallId,
    elapsed_ms: Date.now() - toolStarted,
    ok: (result as { ok?: boolean }).ok ?? null,
    status: (result as { status?: string }).status ?? null,
    live_context_event_count: liveContext.events.length,
  });

  const withLiveContext = attachLiveContextEventsToToolResult(
    result as Record<string, unknown>,
    liveContext.events,
  );
  return withLiveContext;
}

export async function resolveVoiceV3DelegatedRuntimeContextForLiveKitBridge(
  payload: { liveSessionId: string; delegationId?: string | null },
): Promise<Record<string, unknown>> {
  return resolveVoiceV3DelegatedRuntimeContextForLiveKit(payload);
}

export function commitVoiceV3CallerUtteranceForLiveKit(input: {
  liveSessionId: string;
  utterance: string;
}): { committed: boolean; sequence: number | null; turnId: string | null } {
  const turn = commitFinalCallerUtterance(input.liveSessionId, input.utterance);
  if (!turn) {
    return { committed: false, sequence: null, turnId: null };
  }

  appendVoiceV3ForensicEvent(input.liveSessionId, "CALLER_UTTERANCE_COMMITTED", {
    turn_id: turn.turnId,
    sequence: turn.sequence,
    utterance_chars: turn.transcript.length,
    text: turn.transcript,
    committed_at: turn.committedAt,
  });
  mergeCanonicalConversationTurn(input.liveSessionId, {
    role: "user",
    text: turn.transcript,
    committedVia: "commit_voice_v3_livekit_caller_utterance",
    turnKey: turn.turnId,
    textAvailableAt: turn.committedAt,
  });

  return { committed: true, sequence: turn.sequence, turnId: turn.turnId };
}

/** Catalog metadata for tests (no secrets). */
export function listVoiceV3LiveKitCertToolDefinitions(): string[] {
  return VOICE_TOOL_CATALOG.map((e) => e.name);
}
