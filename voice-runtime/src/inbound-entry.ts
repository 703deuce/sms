import type { JobContext } from "@livekit/agents";
import { voice } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { liveKitRuntimeProvider } from "@/lib/voice/runtime-provider/livekit";
import { bootstrapLiveKitCallContext } from "@/lib/voice/domain-actions";
import { resolveAgentRoutingForCall } from "@/lib/telephony/provisioning";
import { createAmyReceptionistAgent } from "./amy-receptionist-agent";
import { CalendlyCalendar } from "./frontdesk/calendly-calendar";
import { createFrontDeskBookingAgent } from "./frontdesk/frontdesk-booking-agent";
import { isFrontDeskProfile } from "./frontdesk/userdata";
import { resolveInboundSipCallIdentity } from "./call-identity";
import type { VoiceRuntimeUserData } from "./metadata";
import { buildAmyVoicePipeline, describePipelineConfig } from "./pipeline";
import { attachLatencyInstrumentation } from "./latency-instrumentation";
import { attachLiveKitTranscriptPersistence } from "./transcript-persistence";
import { attachOutputGain, resolveLiveKitOutputGainDb } from "./output-gain";
import {
  buildAmyTurnHandling,
  describeTurnHandlingConfig,
  getPreemptiveConfigForInstrumentation,
} from "./turn-config";

/** Inbound SIP path — Amy or Frontdesk on the shared voice-runtime worker. */
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

  const routing = await resolveAgentRoutingForCall({
    workspaceId: identity.parsedMeta?.workspaceId,
    agentId: identity.parsedMeta?.agentId,
    toE164: identity.toE164,
  });

  if (!routing) {
    throw new Error(
      `No Transovo agent routing for called number ${identity.toE164 || "(unknown)"} — assign the DID to an active agent`,
    );
  }

  const prisma = getPrisma();
  const agentRow = await prisma.voiceAgent.findFirst({
    where: { id: routing.agentId, workspaceId: routing.workspaceId },
    select: { draftConfig: true, name: true },
  });
  const agentConfig = parseVoiceAgentConfig(agentRow?.draftConfig);
  const outputGainDb = resolveLiveKitOutputGainDb(agentConfig.voiceLanguage?.outputGainDb);
  const useFrontDesk = isFrontDeskProfile(agentConfig.advanced);

  const { callId } = await liveKitRuntimeProvider.bootstrapSession({
    workspaceId: routing.workspaceId,
    agentId: routing.agentId,
    callId: identity.parsedMeta?.callId,
    fromE164: identity.fromE164,
    toE164: identity.toE164 || routing.e164,
    livekitRoomName: ctx.room.name,
    livekitParticipantId: identity.participant.identity,
    lightweightBootstrap: useFrontDesk,
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

  const { stt, llm, tts, config, sttConfig } = buildAmyVoicePipeline();
  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "pipeline_config",
      callId,
      profile: useFrontDesk ? "frontdesk" : "amy",
      pipeline: describePipelineConfig(config, sttConfig),
      turnHandling: describeTurnHandlingConfig(),
      outputGainDb,
    }),
  );

  let userData: VoiceRuntimeUserData;
  let agent: voice.Agent<VoiceRuntimeUserData>;

  if (useFrontDesk) {
    const cal = CalendlyCalendar.create({
      workspaceId: routing.workspaceId,
      agentId: routing.agentId,
      callId,
      timezone,
    });
    userData = {
      workspaceId: routing.workspaceId,
      agentId: routing.agentId,
      callId,
      businessName,
      timezone,
      cal,
      slotUnavailableCount: 0,
      callerE164: identity.fromE164?.trim() || undefined,
    };
    agent = createFrontDeskBookingAgent({ businessName, timezone }) as voice.Agent<VoiceRuntimeUserData>;
    ctx.proc.userData = userData;
  } else {
    const callContext = await bootstrapLiveKitCallContext({
      callId,
      workspaceId: routing.workspaceId,
      agentId: routing.agentId,
      fromE164: identity.fromE164,
      toE164: identity.toE164 || routing.e164,
    });
    userData = { callContext };
    agent = createAmyReceptionistAgent(callContext.businessName) as voice.Agent<VoiceRuntimeUserData>;
    ctx.proc.userData = userData;
  }

  const session = new voice.AgentSession<VoiceRuntimeUserData>({
    stt,
    llm,
    tts,
    turnHandling: buildAmyTurnHandling(),
    maxToolSteps: Number(process.env.VOICE_MAX_TOOL_STEPS?.trim()) || (useFrontDesk ? 4 : 8),
    userData,
  });

  attachLatencyInstrumentation(session, {
    callId,
    preemptiveConfig: getPreemptiveConfigForInstrumentation(),
    ttsConfig: {
      preset: config.ttsPreset || null,
      provider: config.ttsProvider,
      model: config.ttsModel,
      voice: config.ttsVoice,
    },
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
