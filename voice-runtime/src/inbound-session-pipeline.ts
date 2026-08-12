import type { JobContext } from "@livekit/agents";
import { voice } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { liveKitRuntimeProvider } from "@/lib/voice/runtime-provider/livekit";
import { usesFrontDeskRealtimeVoicePipeline } from "@/lib/voice/frontdesk/agent-config";
import { resolveOutboundRealtimePipelineConfig } from "@/lib/voice/outbound/agent-config";
import { CalendlyCalendar } from "./frontdesk/calendly-calendar";
import { createFrontDeskBookingAgent } from "./frontdesk/frontdesk-booking-agent";
import { createRealEstateFrontDeskAgent } from "./frontdesk/real-estate/real-estate-frontdesk-agent";
import { isRealEstateFrontDeskProfile } from "@/lib/voice/frontdesk/agent-config";
import { appendIntakeUtterance } from "@/lib/voice/real-estate/intake-memory";
import { createInitialCallState } from "@/lib/voice/real-estate/state";
import { getCompiledFrontDeskFromAdvanced } from "@/lib/voice/real-estate/config";
import {
  manifestFromCompiledIntents,
  setActiveCompiledIntents,
  setActiveFieldManifest,
} from "@/lib/voice/real-estate/fields";
import type { FrontDeskUserData } from "./frontdesk/userdata";
import {
  buildAmyVoicePipeline,
  buildOutboundRealtimeSessionComponents,
  describePipelineConfig,
  describeRealtimePipelineConfig,
  resolveOutboundRealtimeOutputMode,
} from "./pipeline";
import { attachLatencyInstrumentation } from "./latency-instrumentation";
import { attachLiveKitTranscriptPersistence } from "./transcript-persistence";
import { attachOutputGain, resolveLiveKitOutputGainDb } from "./output-gain";
import {
  buildAmyTurnHandling,
  describeTurnHandlingConfig,
  getPreemptiveConfigForInstrumentation,
} from "./turn-config";
import {
  loadExplicitDispatchForDid,
  mergeExplicitDispatchMetadata,
  parseJobDispatchMetadata,
} from "@/lib/telephony/provisioning";
import { resolveInboundFrontDeskRouting } from "@/lib/voice/frontdesk/resolve-frontdesk-agent";
import { resolveInboundSipCallIdentity } from "./call-identity";

export type InboundSessionContext = {
  identity: Awaited<ReturnType<typeof resolveInboundSipCallIdentity>>;
  routing: Awaited<ReturnType<typeof resolveInboundFrontDeskRouting>>;
  callId: string;
  agentConfig: Awaited<
    ReturnType<typeof import("@/lib/voice/real-estate/publish").loadVoiceAgentConfigForCall>
  >["config"];
  loaded: Awaited<
    ReturnType<typeof import("@/lib/voice/real-estate/publish").loadVoiceAgentConfigForCall>
  >;
  agentRow: { draftConfig: unknown; name: string | null; publishedVersionId: string | null } | null;
  timezone: string;
  businessName: string;
  isRealEstate: boolean;
  compiledFrontDesk: ReturnType<typeof getCompiledFrontDeskFromAdvanced>;
  userData: FrontDeskUserData;
  agent: voice.Agent<FrontDeskUserData>;
  outputGainDb: number;
  useRealtime: boolean;
  maxToolSteps: number;
};

export async function resolveCall(ctx: JobContext) {
  const identity = await resolveInboundSipCallIdentity(ctx);
  const jobMeta = parseJobDispatchMetadata(ctx.job.metadata);
  const didDispatch = await loadExplicitDispatchForDid(identity.toE164);
  const explicit = mergeExplicitDispatchMetadata(
    jobMeta ? { ...jobMeta, dispatchSource: "job_metadata" } : null,
    identity.parsedMeta ? { ...identity.parsedMeta, dispatchSource: "sip_metadata" } : null,
    didDispatch,
  );

  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "inbound_call_identity",
      room: ctx.room.name,
      toE164: identity.toE164 || null,
      toE164Source: identity.toE164Source,
      fromE164: identity.fromE164 || null,
      explicitDispatch: explicit
        ? {
            workspaceId: explicit.workspaceId,
            agentId: explicit.agentId,
            publishedVersionId: explicit.publishedVersionId,
            source: explicit.dispatchSource,
          }
        : null,
      sipAttrKeys: Object.keys(identity.sipAttributes).filter((k) => k.startsWith("sip.")),
    }),
  );

  return { identity, explicit };
}

export async function loadTenantAndPublishedAgent(input: {
  ctx: JobContext;
  identity: Awaited<ReturnType<typeof resolveInboundSipCallIdentity>>;
  explicit: ReturnType<typeof mergeExplicitDispatchMetadata>;
}): Promise<{
  routing: Awaited<ReturnType<typeof resolveInboundFrontDeskRouting>>;
  agentRow: InboundSessionContext["agentRow"];
  callId: string;
  loaded: InboundSessionContext["loaded"];
  agentConfig: InboundSessionContext["agentConfig"];
}> {
  const routing = await resolveInboundFrontDeskRouting({
    workspaceId: input.explicit?.workspaceId || input.identity.parsedMeta?.workspaceId,
    agentId: input.explicit?.agentId || input.identity.parsedMeta?.agentId,
    publishedVersionId:
      input.explicit?.publishedVersionId || input.identity.parsedMeta?.publishedVersionId,
    toE164: input.identity.toE164,
  });

  if (routing.metadataAgentId && routing.metadataAgentId !== routing.agentId) {
    console.log(
      JSON.stringify({
        source: "transovo-voice-runtime",
        event: "inbound_routing_override",
        toE164: input.identity.toE164,
        metadataAgentId: routing.metadataAgentId,
        resolvedAgentId: routing.agentId,
        resolvedAgentName: routing.agentName,
        explicitAgentId: input.explicit?.agentId || null,
      }),
    );
  }

  const prisma = getPrisma();
  const agentRow = await prisma.voiceAgent.findFirst({
    where: { id: routing.agentId, workspaceId: routing.workspaceId },
    select: { draftConfig: true, name: true, publishedVersionId: true },
  });

  const { callId } = await liveKitRuntimeProvider.bootstrapSession({
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    callId: input.identity.parsedMeta?.callId,
    fromE164: input.identity.fromE164,
    toE164: input.identity.toE164 || routing.e164,
    livekitRoomName: input.ctx.room.name,
    livekitParticipantId: input.identity.participant.identity,
    lightweightBootstrap: true,
  });

  const callRow = await prisma.voiceCall.findFirst({
    where: { id: callId, workspaceId: routing.workspaceId },
    select: { agentVersionId: true, metadata: true },
  });

  const pinnedVersionId =
    input.explicit?.publishedVersionId ||
    routing.publishedVersionId ||
    callRow?.agentVersionId ||
    undefined;

  const { loadVoiceAgentConfigForCall } = await import("@/lib/voice/real-estate/publish");
  const loaded = await loadVoiceAgentConfigForCall({
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    agentVersionId: pinnedVersionId,
  });

  return {
    routing,
    agentRow,
    callId,
    loaded,
    agentConfig: loaded.config,
  };
}

export function buildSessionContext(input: {
  ctx: JobContext;
  identity: Awaited<ReturnType<typeof resolveInboundSipCallIdentity>>;
  routing: Awaited<ReturnType<typeof resolveInboundFrontDeskRouting>>;
  callId: string;
  agentConfig: InboundSessionContext["agentConfig"];
  loaded: InboundSessionContext["loaded"];
  agentRow: InboundSessionContext["agentRow"];
}): Omit<
  InboundSessionContext,
  "outputGainDb" | "useRealtime" | "maxToolSteps" | "agent" | "userData"
> & {
  outputGainDb: number;
  useRealtime: boolean;
  maxToolSteps: number;
} {
  const isRealEstate = isRealEstateFrontDeskProfile(input.agentConfig);
  const compiledFrontDesk = isRealEstate
    ? getCompiledFrontDeskFromAdvanced(input.agentConfig.advanced as Record<string, unknown>)
    : null;

  if (compiledFrontDesk) {
    setActiveFieldManifest(manifestFromCompiledIntents(compiledFrontDesk.intents));
    const enabledMap: Partial<Record<string, { enabled: boolean }>> = {};
    for (const [intent, cfg] of Object.entries(compiledFrontDesk.intents)) {
      enabledMap[intent] = { enabled: cfg.enabled };
    }
    setActiveCompiledIntents(enabledMap);
  } else {
    setActiveFieldManifest(null);
    setActiveCompiledIntents(null);
  }

  const useRealtime = usesFrontDeskRealtimeVoicePipeline(input.agentConfig);
  const advanced = input.agentConfig.advanced as Record<string, unknown> | undefined;
  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "inbound_agent_profile",
      callId: input.callId,
      agentId: input.routing.agentId,
      agentName: input.agentRow?.name || input.routing.agentName || null,
      configSource: input.loaded.source,
      agentVersionId: input.loaded.agentVersionId,
      livekitProfile: advanced?.livekitProfile || null,
      realEstateFrontDesk: advanced?.realEstateFrontDesk === true,
      hasCompiledFrontDesk: Boolean(advanced?.realEstateCompiled),
      dispatchSource: input.routing.dispatchSource || null,
      runtimeProfile: isRealEstate
        ? useRealtime
          ? "frontdesk_real_estate_realtime"
          : "frontdesk_real_estate"
        : useRealtime
          ? "frontdesk_realtime"
          : "frontdesk",
    }),
  );

  return {
    identity: input.identity,
    routing: input.routing,
    callId: input.callId,
    agentConfig: input.agentConfig,
    loaded: input.loaded,
    agentRow: input.agentRow,
    timezone: "", // filled by createAgentAndUserData
    businessName: "",
    isRealEstate,
    compiledFrontDesk,
    outputGainDb: resolveLiveKitOutputGainDb(input.agentConfig.voiceLanguage?.outputGainDb),
    useRealtime,
    maxToolSteps:
      Number(process.env.VOICE_MAX_TOOL_STEPS?.trim()) || (isRealEstate ? 12 : 8),
  };
}

export async function createAgentAndUserData(input: {
  ctx: JobContext;
  sessionBase: ReturnType<typeof buildSessionContext>;
  routing: Awaited<ReturnType<typeof resolveInboundFrontDeskRouting>>;
  callId: string;
  agentConfig: InboundSessionContext["agentConfig"];
  loaded: InboundSessionContext["loaded"];
  agentRow: InboundSessionContext["agentRow"];
  identity: Awaited<ReturnType<typeof resolveInboundSipCallIdentity>>;
}): Promise<Pick<InboundSessionContext, "userData" | "agent" | "timezone" | "businessName">> {
  const prisma = getPrisma();
  const messaging = await prisma.workspaceMessagingSettings.findUnique({
    where: { workspaceId: input.routing.workspaceId },
    select: { timezone: true },
  });
  const timezone = String(
    input.agentConfig.dynamicVariables?.business_timezone ||
      messaging?.timezone ||
      "America/New_York",
  );
  const businessName =
    String(input.agentConfig.dynamicVariables?.business_name || "").trim() ||
    input.agentRow?.name?.trim() ||
    "our office";

  const cal = CalendlyCalendar.create({
    workspaceId: input.routing.workspaceId,
    agentId: input.routing.agentId,
    callId: input.callId,
    timezone,
  });

  const userData: FrontDeskUserData = {
    workspaceId: input.routing.workspaceId,
    agentId: input.routing.agentId,
    callId: input.callId,
    businessName,
    timezone,
    cal,
    slotUnavailableCount: 0,
    callerE164: input.identity.fromE164?.trim() || undefined,
    livekitRoomName: input.ctx.room.name,
    livekitParticipantId: input.identity.participant.identity,
    ...(input.sessionBase.isRealEstate
      ? {
          callState: createInitialCallState(),
          realEstateCompiled: input.sessionBase.compiledFrontDesk || undefined,
          agentConfigVersion:
            (input.agentConfig.advanced as Record<string, unknown> | undefined)?.configVersion as
              | number
              | undefined,
          agentVersionId: input.loaded.agentVersionId || undefined,
        }
      : {}),
  };

  const agent = (
    input.sessionBase.isRealEstate
      ? createRealEstateFrontDeskAgent({
          businessName,
          timezone,
          dynamicVariables: input.agentConfig.dynamicVariables as Record<string, unknown> | null,
          publishedConfig: input.sessionBase.compiledFrontDesk || undefined,
        })
      : createFrontDeskBookingAgent({
          businessName,
          timezone,
        })
  ) as voice.Agent<FrontDeskUserData>;

  return { userData, agent, timezone, businessName };
}

export function createVoicePipeline(input: {
  sessionBase: ReturnType<typeof buildSessionContext>;
  agentConfig: InboundSessionContext["agentConfig"];
  routing: Awaited<ReturnType<typeof resolveInboundFrontDeskRouting>>;
  callId: string;
  agentRow: InboundSessionContext["agentRow"];
  userData: FrontDeskUserData;
}): {
  session: voice.AgentSession<FrontDeskUserData>;
  latencyPipelineKind: "stack" | "realtime_native" | "realtime_elevenlabs";
  latencyTtsConfig:
    | {
        preset?: string | null;
        provider?: string;
        model?: string;
        voice?: string;
      }
    | undefined;
} {
  let session: voice.AgentSession<FrontDeskUserData>;
  let latencyPipelineKind: "stack" | "realtime_native" | "realtime_elevenlabs" = "stack";
  let latencyTtsConfig:
    | {
        preset?: string | null;
        provider?: string;
        model?: string;
        voice?: string;
      }
    | undefined;

  if (input.sessionBase.useRealtime) {
    const realtimeOverrides = { enableInputAudioTranscription: true };
    const realtimeCfg = resolveOutboundRealtimePipelineConfig(input.agentConfig, realtimeOverrides);
    const outputMode = resolveOutboundRealtimeOutputMode();
    const { llm, tts, pipelineCfg } = buildOutboundRealtimeSessionComponents(
      input.agentConfig,
      realtimeOverrides,
    );
    latencyPipelineKind =
      outputMode === "elevenlabs" ? "realtime_elevenlabs" : "realtime_native";
    latencyTtsConfig =
      outputMode === "elevenlabs"
        ? {
            preset: pipelineCfg.ttsPreset || null,
            provider: pipelineCfg.ttsProvider,
            model: pipelineCfg.ttsModel,
            voice: pipelineCfg.ttsVoice,
          }
        : {
            provider: "openai_realtime",
            model: realtimeCfg.model,
            voice: realtimeCfg.voice,
          };
    console.log(
      JSON.stringify({
        source: "transovo-voice-runtime",
        event: "pipeline_config",
        callId: input.callId,
        agentId: input.routing.agentId,
        agentName: input.agentRow?.name || null,
        profile: input.sessionBase.isRealEstate
          ? "frontdesk_real_estate_realtime"
          : "frontdesk_realtime",
        pipeline: describeRealtimePipelineConfig(realtimeCfg, outputMode, pipelineCfg, {
          inputAudioTranscription: true,
        }),
        outputGainDb: input.sessionBase.outputGainDb,
      }),
    );

    session = new voice.AgentSession<FrontDeskUserData>({
      llm,
      ...(tts ? { tts } : {}),
      maxToolSteps: input.sessionBase.maxToolSteps,
      userData: input.userData,
    });
  } else {
    const { stt, llm, tts, config, sttConfig } = buildAmyVoicePipeline();
    latencyTtsConfig = {
      preset: config.ttsPreset || null,
      provider: config.ttsProvider,
      model: config.ttsModel,
      voice: config.ttsVoice,
    };
    console.log(
      JSON.stringify({
        source: "transovo-voice-runtime",
        event: "pipeline_config",
        callId: input.callId,
        agentId: input.routing.agentId,
        agentName: input.agentRow?.name || null,
        profile: input.sessionBase.isRealEstate ? "frontdesk_real_estate" : "frontdesk",
        pipeline: describePipelineConfig(config, sttConfig),
        turnHandling: describeTurnHandlingConfig(),
        outputGainDb: input.sessionBase.outputGainDb,
      }),
    );

    session = new voice.AgentSession<FrontDeskUserData>({
      stt,
      llm,
      tts,
      turnHandling: buildAmyTurnHandling(),
      maxToolSteps: input.sessionBase.maxToolSteps,
      userData: input.userData,
    });
  }

  return { session, latencyPipelineKind, latencyTtsConfig };
}

export function attachObservers(input: {
  ctx: JobContext;
  session: voice.AgentSession<FrontDeskUserData>;
  callId: string;
  routing: Awaited<ReturnType<typeof resolveInboundFrontDeskRouting>>;
  latencyPipelineKind: "stack" | "realtime_native" | "realtime_elevenlabs";
  latencyTtsConfig:
    | {
        preset?: string | null;
        provider?: string;
        model?: string;
        voice?: string;
      }
    | undefined;
}): void {
  attachLatencyInstrumentation(input.session, {
    callId: input.callId,
    pipelineKind: input.latencyPipelineKind,
    preemptiveConfig:
      input.latencyPipelineKind === "stack"
        ? getPreemptiveConfigForInstrumentation()
        : { enabled: false, preemptiveTts: false },
    ttsConfig: input.latencyTtsConfig,
  });

  attachLiveKitTranscriptPersistence(input.session, {
    workspaceId: input.routing.workspaceId,
    callId: input.callId,
    onUserUtterance: (session, text) => {
      const ud = session.userData;
      if (ud.callState) {
        ud.callState = appendIntakeUtterance(ud.callState, text);
      }
    },
  });

  input.ctx.addShutdownCallback(async () => {
    await liveKitRuntimeProvider.endSession(input.callId);
  });
}

export async function startInboundSession(input: {
  ctx: JobContext;
  session: voice.AgentSession<FrontDeskUserData>;
  agent: voice.Agent<FrontDeskUserData>;
  userData: FrontDeskUserData;
  outputGainDb: number;
}): Promise<void> {
  input.ctx.proc.userData = input.userData;
  await input.session.start({
    agent: input.agent,
    room: input.ctx.room,
  });

  if (input.session.output.audio) {
    input.session.output.audio =
      attachOutputGain(input.session.output.audio, input.outputGainDb) ??
      input.session.output.audio;
  }
}
