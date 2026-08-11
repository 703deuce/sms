import type { JobContext } from "@livekit/agents";
import { voice } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { liveKitRuntimeProvider } from "@/lib/voice/runtime-provider/livekit";
import { usesFrontDeskRealtimeVoicePipeline } from "@/lib/voice/frontdesk/agent-config";
import { resolveInboundFrontDeskRouting } from "@/lib/voice/frontdesk/resolve-frontdesk-agent";
import { resolveOutboundRealtimePipelineConfig } from "@/lib/voice/outbound/agent-config";
import { CalendlyCalendar } from "./frontdesk/calendly-calendar";
import { createFrontDeskBookingAgent } from "./frontdesk/frontdesk-booking-agent";
import { createRealEstateFrontDeskAgent } from "./frontdesk/real-estate/real-estate-frontdesk-agent";
import { isRealEstateFrontDeskProfile } from "@/lib/voice/frontdesk/agent-config";
import { createInitialCallState } from "@/lib/voice/real-estate/state";
import { getCompiledFrontDeskFromAdvanced } from "@/lib/voice/real-estate/config";
import {
  manifestFromCompiledIntents,
  setActiveFieldManifest,
} from "@/lib/voice/real-estate/fields";
import { resolveInboundSipCallIdentity } from "./call-identity";
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

/** Inbound SIP path — frontdesk booking only (no Amy). */
export async function runInboundEntry(ctx: JobContext): Promise<void> {
  const identity = await resolveInboundSipCallIdentity(ctx);

  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "inbound_call_identity",
      room: ctx.room.name,
      toE164: identity.toE164 || null,
      toE164Source: identity.toE164Source,
      fromE164: identity.fromE164 || null,
      sipAttrKeys: Object.keys(identity.sipAttributes).filter((k) => k.startsWith("sip.")),
    }),
  );

  const routing = await resolveInboundFrontDeskRouting({
    workspaceId: identity.parsedMeta?.workspaceId,
    agentId: identity.parsedMeta?.agentId,
    toE164: identity.toE164,
  });

  if (routing.metadataAgentId && routing.metadataAgentId !== routing.agentId) {
    console.log(
      JSON.stringify({
        source: "transovo-voice-runtime",
        event: "inbound_routing_override",
        toE164: identity.toE164,
        metadataAgentId: routing.metadataAgentId,
        resolvedAgentId: routing.agentId,
        resolvedAgentName: routing.agentName,
      }),
    );
  }

  const prisma = getPrisma();
  const agentRow = await prisma.voiceAgent.findFirst({
    where: { id: routing.agentId, workspaceId: routing.workspaceId },
    select: { draftConfig: true, name: true },
  });
  const agentConfig = parseVoiceAgentConfig(agentRow?.draftConfig);
  const outputGainDb = resolveLiveKitOutputGainDb(agentConfig.voiceLanguage?.outputGainDb);
  const useRealtime = usesFrontDeskRealtimeVoicePipeline(agentConfig);
  const isRealEstate = isRealEstateFrontDeskProfile(agentConfig);

  const { callId } = await liveKitRuntimeProvider.bootstrapSession({
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    callId: identity.parsedMeta?.callId,
    fromE164: identity.fromE164,
    toE164: identity.toE164 || routing.e164,
    livekitRoomName: ctx.room.name,
    livekitParticipantId: identity.participant.identity,
    lightweightBootstrap: true,
  });

  const messaging = await prisma.workspaceMessagingSettings.findUnique({
    where: { workspaceId: routing.workspaceId },
    select: { timezone: true },
  });
  const timezone = String(
    agentConfig.dynamicVariables?.business_timezone ||
      messaging?.timezone ||
      "America/New_York",
  );
  const businessName =
    String(agentConfig.dynamicVariables?.business_name || "").trim() ||
    agentRow?.name?.trim() ||
    "our office";

  const compiledFrontDesk = isRealEstate
    ? getCompiledFrontDeskFromAdvanced(agentConfig.advanced as Record<string, unknown>)
    : null;
  if (compiledFrontDesk) {
    setActiveFieldManifest(manifestFromCompiledIntents(compiledFrontDesk.intents));
  } else {
    setActiveFieldManifest(null);
  }

  const cal = CalendlyCalendar.create({
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    callId,
    timezone,
  });
  const userData: FrontDeskUserData = {
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    callId,
    businessName,
    timezone,
    cal,
    slotUnavailableCount: 0,
    callerE164: identity.fromE164?.trim() || undefined,
    livekitRoomName: ctx.room.name,
    livekitParticipantId: identity.participant.identity,
    ...(isRealEstate
      ? {
          callState: createInitialCallState(),
          realEstateCompiled: compiledFrontDesk || undefined,
        }
      : {}),
  };
  const agent = (
    isRealEstate
      ? createRealEstateFrontDeskAgent({
          businessName,
          timezone,
          dynamicVariables: agentConfig.dynamicVariables as Record<string, unknown> | null,
        })
      : createFrontDeskBookingAgent({
          businessName,
          timezone,
        })
  ) as voice.Agent<FrontDeskUserData>;
  ctx.proc.userData = userData;

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

  const maxToolSteps =
    Number(process.env.VOICE_MAX_TOOL_STEPS?.trim()) || (isRealEstate ? 12 : 8);

  if (useRealtime) {
    const realtimeCfg = resolveOutboundRealtimePipelineConfig(agentConfig);
    const outputMode = resolveOutboundRealtimeOutputMode();
    const { llm, tts, pipelineCfg } = buildOutboundRealtimeSessionComponents(agentConfig);
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
        callId,
        agentId: routing.agentId,
        agentName: agentRow?.name || null,
        profile: isRealEstate ? "frontdesk_real_estate_realtime" : "frontdesk_realtime",
        pipeline: describeRealtimePipelineConfig(realtimeCfg, outputMode, pipelineCfg),
        outputGainDb,
      }),
    );

    session = new voice.AgentSession<FrontDeskUserData>({
      llm,
      ...(tts ? { tts } : {}),
      maxToolSteps,
      userData,
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
        callId,
        agentId: routing.agentId,
        agentName: agentRow?.name || null,
        profile: isRealEstate ? "frontdesk_real_estate" : "frontdesk",
        pipeline: describePipelineConfig(config, sttConfig),
        turnHandling: describeTurnHandlingConfig(),
        outputGainDb,
      }),
    );

    session = new voice.AgentSession<FrontDeskUserData>({
      stt,
      llm,
      tts,
      turnHandling: buildAmyTurnHandling(),
      maxToolSteps,
      userData,
    });
  }

  attachLatencyInstrumentation(session, {
    callId,
    pipelineKind: latencyPipelineKind,
    preemptiveConfig:
      latencyPipelineKind === "stack"
        ? getPreemptiveConfigForInstrumentation()
        : { enabled: false, preemptiveTts: false },
    ttsConfig: latencyTtsConfig,
  });

  attachLiveKitTranscriptPersistence(session, {
    workspaceId: routing.workspaceId,
    callId,
  });

  ctx.addShutdownCallback(async () => {
    await liveKitRuntimeProvider.endSession(callId);
  });

  await session.start({
    agent,
    room: ctx.room,
  });

  if (session.output.audio) {
    session.output.audio = attachOutputGain(session.output.audio, outputGainDb) ?? session.output.audio;
  }
}
