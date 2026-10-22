import "server-only";

import { getPrisma } from "@/lib/server/db";
import { compileReceptionistRuntimeBundle } from "@/lib/server/receptionist/agent-service";
import { loadLiveEditorFromPublished } from "@/lib/server/receptionist/agent-store";
import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";
import { putLiveSession } from "@/lib/server/receptionist/runtime/session-store";
import type { LiveKitBootstrapPayload } from "@/lib/server/receptionist/runtime/session";
import {
  isSipParticipantDialedE164Source,
  isTrustedInboundDialedE164Source,
  productionRequiresSipDialAttribution,
} from "@/lib/server/receptionist/livekit/canonical-dispatch-helpers";
import {
  normalizeE164,
  resolveReceptionistByCalledNumber,
} from "@/lib/server/receptionist/routing-resolve";
import { voiceV3AgentConfigFromBundle } from "@/lib/server/voice-v3/bundle-voice-config";
import { enrichVoiceV3AgentConfigForRuntime } from "@/lib/server/voice-v3/enrich-runtime-config";
import { createVoiceV3CallRuntime } from "@/lib/server/voice-v3/state/call-runtime";
import type { VoiceV3CallContext } from "@/lib/server/voice-v3/state/call-context";
import { ensureVoiceCallRowOnSessionResolve } from "@/lib/server/voice-v3/post-call/ensure-voice-call-row";
import {
  coalesceRuntimeProfileForVoiceConfig,
  isConversationalIvrRuntime,
  withRuntimeProfileFromEditor,
} from "@/lib/receptionist/runtime-profile";
import { enabledVoiceToolNamesFromEditor } from "@/lib/server/receptionist/editor-screen-mapping";
import { buildVoiceV3AstraFunctionToolsFromCatalog } from "@/lib/server/voice-v3/tools/voice-tool-catalog";
import {
  appendVoiceV3ForensicEvent,
  initVoiceV3CallForensics,
} from "@/lib/server/voice-v3/telemetry/call-forensics";
import { buildLiveKitIntakeFieldMetadata } from "@/lib/server/voice-v3/tools/livekit-intake-tool-schemas";
import { resolvePhoneFoundationForVoiceV3Session } from "@/lib/server/voice-v3/resolve-phone-foundation";
import type { FunctionTool } from "openai/resources/live/live";

/** Tools executed natively in the LiveKit Python worker (not Astra FunctionTools). */
const VOICE_V3_LIVEKIT_NATIVE_TOOL_NAMES = new Set(["end_call"]);

function toolSchemaName(tool: FunctionTool): string {
  return String(tool.name ?? "");
}

function filterToolsForLiveKitSession(tools: FunctionTool[]): FunctionTool[] {
  return tools.filter((t) => !VOICE_V3_LIVEKIT_NATIVE_TOOL_NAMES.has(toolSchemaName(t)));
}

const BROWSER_TEST_PREFIX =
  process.env.LIVEKIT_BROWSER_TEST_ROOM_PREFIX?.trim() || "transovo-browser-test-";

function liveSessionIdForRoom(roomName: string): string {
  const room = roomName.trim();
  return room.startsWith("lk_") ? room : `lk_${room}`;
}

function assertInboundSipBootstrapTrust(payload: LiveKitBootstrapPayload, roomName: string): void {
  const isBrowserTest = roomName.startsWith(BROWSER_TEST_PREFIX);
  if (isBrowserTest) return;

  if (payload.workspaceId || payload.agentId || payload.useDraft) {
    throw new Error(
      "Inbound SIP session resolve rejects workspace/agent hints — use called DID routing only",
    );
  }

  if (payload.bootstrapPath === "phone_call_control") {
    if (!payload.humanCallId?.trim()) {
      throw new Error("humanCallId is required for phone_call_control bootstrap");
    }
    return;
  }

  if (payload.bootstrapPath !== "livekit_sip") {
    throw new Error(
      "Inbound SIP resolve requires bootstrapPath livekit_sip or phone_call_control from authenticated transovo-voice-v3 worker",
    );
  }

  const dialed = payload.dialedE164?.trim();
  if (!dialed) throw new Error("dialedE164 is required for inbound SIP");

  const sipIdentity = payload.sipParticipantIdentity?.trim();
  if (!sipIdentity) {
    throw new Error("sipParticipantIdentity is required for inbound SIP");
  }

  const source = payload.dialedE164Source?.trim();
  if (productionRequiresSipDialAttribution()) {
    if (!source) {
      throw new Error(
        "dialedE164Source is required for production PSTN (SIP participant attributes from LiveKit)",
      );
    }
    if (!isSipParticipantDialedE164Source(source)) {
      throw new Error(
        `Production PSTN requires SIP-participant dialed attribution (e.g. sip.trunkPhoneNumber), not: ${source}`,
      );
    }
  } else if (source && !isTrustedInboundDialedE164Source(source)) {
    throw new Error(`Untrusted dialedE164Source: ${source}`);
  }
}

async function loadPublishedBundle(
  workspaceId: string,
  agentId: string,
  publishedVersionId: string,
): Promise<ReceptionistPublishedBundle> {
  const prisma = getPrisma();
  const version = await prisma.voiceAgentVersion.findFirst({
    where: { id: publishedVersionId, workspaceId, agentId },
  });
  if (!version?.config) throw new Error("Published version config missing");
  const config = version.config as Record<string, unknown>;
  const nested = config.newAppReceptionist as ReceptionistPublishedBundle | undefined;
  if (!nested?.editor) {
    throw new Error(
      "Published receptionist is missing newAppReceptionist editor — republish from the new app (four-screen setup). Legacy wizard config is not used for PSTN.",
    );
  }

  const editor = loadLiveEditorFromPublished(version.config, nested.editor);
  const amyLen = nested.runtime?.amyInstructions?.length ?? 0;
  const hasProvenance = nested.configProvenance?.configSource === "new_app_receptionist";
  if (
    nested.runtime?.toolNames?.length &&
    amyLen > 2000 &&
    hasProvenance &&
    nested.runtime.promptFingerprint
  ) {
    return nested;
  }

  return compileReceptionistRuntimeBundle({
    workspaceId,
    agentId,
    editor,
    syncKnowledge: false,
  });
}

export async function resolveNativeVoiceV3LiveKitSession(payload: LiveKitBootstrapPayload) {
  const dialed = payload.dialedE164?.trim();
  const roomName = payload.roomName?.trim();
  if (!roomName) throw new Error("roomName is required");

  const isBrowserTest = roomName.startsWith(BROWSER_TEST_PREFIX);
  assertInboundSipBootstrapTrust(payload, roomName);
  const prisma = getPrisma();

  let workspaceId: string;
  let agentId: string;
  let phoneNumberId: string;
  let bundle: ReceptionistPublishedBundle;
  let configSource: "published" | "draft_test" = "published";
  let publishedVersionId: string | null = null;

  if (isBrowserTest) {
    const meta = payload as LiveKitBootstrapPayload & {
      workspaceId?: string;
      agentId?: string;
      useDraft?: boolean;
    };
    if (!meta.workspaceId || !meta.agentId) {
      throw new Error("Browser test session requires workspaceId and agentId in bootstrap metadata");
    }
    workspaceId = meta.workspaceId;
    agentId = meta.agentId;
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: agentId, workspaceId },
    });
    if (!agent) throw new Error("Agent not found");
    phoneNumberId = agent.phoneNumberId || "";
    configSource = meta.useDraft ? "draft_test" : "published";
    if (configSource === "draft_test") {
      const draft = loadLiveEditorFromPublished(agent.draftConfig, {} as never);
      bundle = await compileReceptionistRuntimeBundle({
        workspaceId,
        agentId,
        editor: draft,
        syncKnowledge: false,
      });
    } else {
      if (!agent.publishedVersionId) throw new Error("Publish the agent before live browser test");
      publishedVersionId = agent.publishedVersionId;
      bundle = await loadPublishedBundle(workspaceId, agentId, publishedVersionId);
    }
  } else {
    if (!dialed) throw new Error("dialedE164 is required for inbound SIP");
    const routing = await resolveReceptionistByCalledNumber(dialed);
    if (!routing || routing.paused) throw new Error(`No active receptionist for ${dialed}`);

    const normalizedDialed = normalizeE164(dialed);
    const ownedPhone = await prisma.phoneNumber.findFirst({
      where: {
        id: routing.phoneNumberId,
        workspaceId: routing.workspaceId,
        e164: normalizedDialed,
        status: "Active",
      },
      select: { id: true },
    });
    if (!ownedPhone) {
      throw new Error("Called number does not match workspace receptionist assignment");
    }

    workspaceId = routing.workspaceId;
    agentId = routing.agentId;
    phoneNumberId = routing.phoneNumberId;

    const agent = await prisma.voiceAgent.findFirst({
      where: { id: agentId, workspaceId },
    });
    if (!agent?.publishedVersionId) {
      throw new Error("Receptionist is not published — inbound calls require a published version");
    }
    publishedVersionId = agent.publishedVersionId;
    bundle = await loadPublishedBundle(workspaceId, agentId, publishedVersionId);
  }

  const liveSessionId = liveSessionIdForRoom(roomName);
  const callId = liveSessionId;
  const rt = bundle.runtime;

  const callerE164 = payload.callerE164?.trim();

  let phoneFoundation: VoiceV3CallContext["phoneFoundation"];
  if (payload.bootstrapPath === "phone_call_control" && payload.humanCallId?.trim()) {
    const humanCallId = payload.humanCallId.trim();
    const hc = await prisma.humanCall.findFirst({
      where: { id: humanCallId, workspaceId },
      select: { id: true, phoneNumberId: true, metadata: true },
    });
    const meta = (hc?.metadata as Record<string, unknown>) || {};
    const orch = (meta.orchestration as Record<string, unknown>) || {};
    const inboundCallControlId =
      payload.inboundCallControlId?.trim() ||
      String(meta.callerCallControlId || "") ||
      "";
    if (hc?.phoneNumberId && inboundCallControlId) {
      phoneFoundation = {
        humanCallId,
        inboundCallControlId,
        workspaceId,
        phoneNumberId: hc.phoneNumberId,
      };
    }
    if (orch.stage === "ai_active") {
      // still on same logical Phone call — do not treat staff ring timeout as missed yet
    }
  } else if (!isBrowserTest) {
    phoneFoundation = await resolvePhoneFoundationForVoiceV3Session({
      workspaceId,
      callerE164: payload.callerE164?.trim() || callerE164,
      businessLineE164: dialed,
      humanCallIdHint: payload.humanCallId?.trim() || null,
      inboundCallControlIdHint: payload.inboundCallControlId?.trim() || null,
      liveSessionId: liveSessionIdForRoom(roomName),
    });
    if (phoneFoundation) {
      console.info(
        JSON.stringify({
          event: "VOICE_V3_PHONE_FOUNDATION_CORRELATED",
          liveSessionId,
          humanCallId: phoneFoundation.humanCallId,
          inboundCallControlPrefix: phoneFoundation.inboundCallControlId.slice(0, 8),
        }),
      );
    }
  }

  let voiceV3Config = voiceV3AgentConfigFromBundle(bundle, {
    workspaceId,
    agentId,
  });
  voiceV3Config = await enrichVoiceV3AgentConfigForRuntime({
    config: voiceV3Config,
    workspaceId,
    editor: bundle.editor,
  });
  voiceV3Config = withRuntimeProfileFromEditor(bundle.editor, voiceV3Config);

  createVoiceV3CallRuntime({
    liveSessionId,
    callId,
    inboundCallerE164: callerE164,
    liveKitRoomName: roomName,
    liveKitSipParticipantIdentity: payload.sipParticipantIdentity?.trim() || null,
    phoneFoundation,
    config: voiceV3Config,
  });

  const catalogTools = buildVoiceV3AstraFunctionToolsFromCatalog(voiceV3Config);
  const editorForTools = {
    ...bundle.editor,
    runtimeProfile: coalesceRuntimeProfileForVoiceConfig(bundle.editor, voiceV3Config),
  };
  const enabledFromEditor = enabledVoiceToolNamesFromEditor(editorForTools);
  const publishedSet = new Set(rt.toolNames);
  const editorSet = new Set(enabledFromEditor);
  const stalePublishedTools =
    publishedSet.size !== editorSet.size ||
    [...editorSet].some((n) => !publishedSet.has(n));
  if (stalePublishedTools) {
    console.warn("VOICE_V3_PUBLISHED_TOOL_NAMES_STALE", {
      liveSessionId,
      agentId,
      published_tool_names: rt.toolNames,
      editor_enabled_tool_names: enabledFromEditor,
    });
  }
  const allowed = editorSet;
  const mergedByName = new Map<string, FunctionTool>();
  for (const t of filterToolsForLiveKitSession(catalogTools)) {
    const name = toolSchemaName(t);
    if (!allowed.has(name)) continue;
    if (name === "update_intake" || name === "collect_intake_field" || name.startsWith("set_intake_")) {
      continue;
    }
    mergedByName.set(name, t);
  }
  const toolSchemas = [...mergedByName.values()];
  const schemaToolNames = toolSchemas.map((t) => toolSchemaName(t));

  initVoiceV3CallForensics({
    callId,
    liveSessionId,
    workspaceId,
    agentId,
  });
  const bookCapability = bundle.editor.capabilities?.book === true;
  const bookLive =
    bookCapability &&
    bundle.editor.appointments?.strategy === "live" &&
    bundle.editor.appointments?.provider !== "none";
  const bookingToolsPresent = schemaToolNames.filter((n) =>
    ["set_scheduling_preference", "find_availability", "book_appointment"].includes(n),
  );
  appendVoiceV3ForensicEvent(liveSessionId, "VOICE_V3_SESSION_TOOL_SURFACE", {
    runtime_profile: voiceV3Config.runtimeProfile ?? null,
    editor_runtime_profile: editorForTools.runtimeProfile ?? null,
    conversational_ivr: isConversationalIvrRuntime(voiceV3Config),
    book_capability: bookCapability,
    appointment_strategy: bundle.editor.appointments?.strategy ?? null,
    appointment_provider: bundle.editor.appointments?.provider ?? null,
    live_booking_configured: bookLive,
    published_tool_names: rt.toolNames,
    editor_enabled_tool_names: enabledFromEditor,
    published_tool_names_stale: stalePublishedTools,
    schema_tool_names: schemaToolNames,
    schema_tool_count: schemaToolNames.length,
    booking_tools_present: bookingToolsPresent,
    booking_tools_missing_when_live_book_expected:
      bookLive && !bookingToolsPresent.includes("find_availability"),
    astra_model: rt.astraModel,
    config_source: configSource,
    published_version_id: publishedVersionId,
  });
  if (bookLive && !bookingToolsPresent.includes("find_availability")) {
    console.error("VOICE_V3_LIVE_BOOKING_TOOLS_MISSING_ON_SESSION", {
      liveSessionId,
      agentId,
      workspaceId,
      schema_tool_names: schemaToolNames,
      editor_enabled_tool_names: enabledFromEditor,
    });
  }

  putLiveSession({
    liveSessionId,
    callId,
    workspaceId,
    agentId,
    phoneNumberId,
    bundle,
    intake: callerE164 ? { inbound_caller_e164: callerE164 } : {},
    configSource,
    publishedVersionId,
    scheduling: {},
  });

  const promptFingerprint = rt.promptFingerprint;
  const configProvenance = bundle.configProvenance;
  if (promptFingerprint) {
    console.info(
      JSON.stringify({
        event: "VOICE_V3_PROMPT_FINGERPRINT",
        liveSessionId,
        workspaceId,
        agentId,
        configSource: configProvenance?.configSource ?? "unknown",
        legacyWizardUsed: configProvenance?.legacyWizardUsed ?? true,
        editorDigest: configProvenance?.editorDigest?.slice(0, 16),
        amyChars: promptFingerprint.amyChars,
        astraChars: promptFingerprint.astraChars,
        amySha256: promptFingerprint.amySha256.slice(0, 16),
        toolNames: promptFingerprint.toolNames,
      }),
    );
  }

  await ensureVoiceCallRowOnSessionResolve({
    callId,
    workspaceId,
    agentId,
    fromE164: payload.callerE164?.trim() || (isBrowserTest ? "browser-tester" : "unknown"),
    toE164: dialed || "browser-test",
    phoneNumberId,
    metadata: {
      liveSessionId,
      roomName,
      configSource,
      publishedVersionId,
      voiceTransport: "voice_v3_livekit",
      phoneFoundationHumanCallId: phoneFoundation?.humanCallId ?? null,
      inboundCallControlId: phoneFoundation?.inboundCallControlId ?? null,
    },
  });

  return {
    liveSessionId,
    callId,
    workspaceId,
    agentId,
    phoneNumberId,
    amyInstructions: rt.amyInstructions,
    astraInstructions: rt.astraInstructions,
    astraModel: rt.astraModel,
    liveVoiceId: rt.liveVoiceId,
    toolSchemas,
    toolNames: toolSchemas.map((t) => toolSchemaName(t)),
    intakeFields: buildLiveKitIntakeFieldMetadata(voiceV3Config),
    parallelToolCalls: false,
    maxToolSteps: rt.maxToolSteps,
    reasoningEffort: "low",
    textVerbosity: "low",
    openaiFileSearchVectorStoreIds: rt.openaiFileSearchVectorStoreIds,
    promptFingerprint: rt.promptFingerprint,
    configProvenance: bundle.configProvenance,
    voiceV3ConfigSource: voiceV3Config.source,
    bookingStrategy: voiceV3Config.scheduling?.bookingStrategy,
  };
}
