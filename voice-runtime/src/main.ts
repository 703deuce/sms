import dotenv from "dotenv";
import { cli, defineAgent, ServerOptions, voice } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { fileURLToPath } from "node:url";
import { liveKitRuntimeProvider } from "@/lib/voice/runtime-provider/livekit";
import { bootstrapLiveKitCallContext } from "@/lib/voice/domain-actions";
import { resolveAgentRoutingForCall } from "@/lib/telephony/provisioning";
import { createAmyAgent } from "./amy-tools";
import { resolveInboundSipCallIdentity } from "./call-identity";
import type { AmyProcessUserData } from "./metadata";
import { buildAmyVoicePipeline, describePipelineConfig } from "./pipeline";
import { applyVoiceRuntimeEnvAliases } from "./env-aliases";
import { attachLatencyInstrumentation } from "./latency-instrumentation";
import { attachOutputGain, resolveLiveKitOutputGainDb } from "./output-gain";
import { buildAmyTurnHandling, describeTurnHandlingConfig, getPreemptiveConfigForInstrumentation } from "./turn-config";

dotenv.config();
applyVoiceRuntimeEnvAliases();

const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME || "transovo-voice-runtime";

export default defineAgent<AmyProcessUserData>({
  entry: async (ctx) => {
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

    const { callId } = await liveKitRuntimeProvider.bootstrapSession({
      workspaceId: routing.workspaceId,
      agentId: routing.agentId,
      callId: identity.parsedMeta?.callId,
      fromE164: identity.fromE164,
      toE164: identity.toE164 || routing.e164,
      livekitRoomName: ctx.room.name,
      livekitParticipantId: identity.participant.identity,
    });

    const callContext = await bootstrapLiveKitCallContext({
      callId,
      workspaceId: routing.workspaceId,
      agentId: routing.agentId,
      fromE164: identity.fromE164,
      toE164: identity.toE164 || routing.e164,
    });

    ctx.proc.userData = { callContext } satisfies AmyProcessUserData;

    const prisma = getPrisma();
    const agentRow = await prisma.voiceAgent.findFirst({
      where: { id: routing.agentId, workspaceId: routing.workspaceId },
      select: { draftConfig: true },
    });
    const agentConfig = parseVoiceAgentConfig(agentRow?.draftConfig);
    const outputGainDb = resolveLiveKitOutputGainDb(agentConfig.voiceLanguage?.outputGainDb);

    const { stt, llm, tts, config, sttConfig } = buildAmyVoicePipeline();
    console.log(
      JSON.stringify({
        source: "transovo-voice-runtime",
        event: "pipeline_config",
        callId,
        pipeline: describePipelineConfig(config, sttConfig),
        turnHandling: describeTurnHandlingConfig(),
        outputGainDb,
      }),
    );
    const agent = createAmyAgent(callContext);

    const session = new voice.AgentSession<AmyProcessUserData>({
      stt,
      llm,
      tts,
      turnHandling: buildAmyTurnHandling(),
      maxToolSteps: Number(process.env.VOICE_MAX_TOOL_STEPS?.trim()) || 6,
      userData: { callContext },
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

    const businessLabel = callContext.businessName?.trim() || "our team";
    const greeting = session.say(
      `Hi, this is Amy with ${businessLabel}. How can I help you today?`,
      { allowInterruptions: false },
    );
    await greeting.waitForPlayout();
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(
    new ServerOptions({
      agent: fileURLToPath(import.meta.url),
      agentName: AGENT_NAME,
    }),
  );
}
