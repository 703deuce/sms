import dotenv from "dotenv";
import { cli, defineAgent, inference, ServerOptions, voice } from "@livekit/agents";
import { fileURLToPath } from "node:url";
import { liveKitRuntimeProvider } from "@/lib/voice/runtime-provider/livekit";
import { bootstrapLiveKitCallContext } from "@/lib/voice/domain-actions";
import { resolveAgentRoutingForCall } from "@/lib/telephony/provisioning";
import { createAmyAgent } from "./amy-tools";
import { parseDispatchAttributes, parseRoomMetadata, type AmyProcessUserData } from "./metadata";
import { buildAmyVoicePipeline, describePipelineConfig } from "./pipeline";
import { attachLatencyInstrumentation } from "./latency-instrumentation";

dotenv.config();

// Accept ELEVENLABS_KEY (Coolify/Telnyx convention) for LiveKit TTS plugin.
if (!process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_KEY?.trim()) {
  process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_KEY.trim();
}

const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME || "transovo-voice-runtime";

export default defineAgent<AmyProcessUserData>({
  entry: async (ctx) => {
    const fromParticipant = [...ctx.room.remoteParticipants.values()][0];
    const participantAttrs = Object.fromEntries(
      [...ctx.room.remoteParticipants.values()].flatMap((p) =>
        Object.entries(p.attributes || {}),
      ),
    );

    const parsedMeta =
      parseRoomMetadata(ctx.room.metadata) || parseDispatchAttributes(participantAttrs);

    const fromE164 =
      parsedMeta?.fromE164 ||
      participantAttrs["sip.phoneNumber"] ||
      fromParticipant?.attributes?.["sip.phoneNumber"] ||
      fromParticipant?.identity;

    const toE164 =
      parsedMeta?.toE164 ||
      participantAttrs["sip.trunkPhoneNumber"] ||
      participantAttrs["sip.calledNumber"] ||
      participantAttrs.calledNumber;

    const routing = await resolveAgentRoutingForCall({
      workspaceId: parsedMeta?.workspaceId,
      agentId: parsedMeta?.agentId,
      toE164,
    });

    if (!routing) {
      throw new Error(
        `No Transovo agent routing for called number ${toE164 || "(unknown)"} — assign the DID to an active agent`,
      );
    }

    const { callId } = await liveKitRuntimeProvider.bootstrapSession({
      workspaceId: routing.workspaceId,
      agentId: routing.agentId,
      callId: parsedMeta?.callId,
      fromE164,
      toE164: toE164 || routing.e164,
      livekitRoomName: ctx.room.name,
      livekitParticipantId: fromParticipant?.identity,
    });

    const callContext = await bootstrapLiveKitCallContext({
      callId,
      workspaceId: routing.workspaceId,
      agentId: routing.agentId,
      fromE164,
      toE164: toE164 || routing.e164,
    });

    ctx.proc.userData = { callContext } satisfies AmyProcessUserData;

    const { stt, llm, tts, config } = buildAmyVoicePipeline();
    console.log(
      JSON.stringify({
        source: "transovo-voice-runtime",
        event: "pipeline_config",
        callId,
        pipeline: describePipelineConfig(config),
      }),
    );
    const agent = createAmyAgent(callContext);

    const session = new voice.AgentSession<AmyProcessUserData>({
      stt,
      llm,
      tts,
      turnHandling: {
        turnDetection: new inference.TurnDetector(),
      },
      userData: { callContext },
    });

    attachLatencyInstrumentation(session, { callId });

    ctx.addShutdownCallback(async () => {
      await liveKitRuntimeProvider.endSession(callId);
    });

    await session.start({
      agent,
      room: ctx.room,
    });

    await ctx.connect();

    await session.generateReply({
      instructions:
        "Greet the caller warmly as Amy. If you already know their phone number, acknowledge it naturally. Ask how you can help today.",
    });
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
