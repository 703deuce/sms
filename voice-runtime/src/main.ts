import dotenv from "dotenv";
import { cli, defineAgent, inference, ServerOptions, voice } from "@livekit/agents";
import { fileURLToPath } from "node:url";
import { liveKitRuntimeProvider } from "@/lib/voice/runtime-provider/livekit";
import { bootstrapLiveKitCallContext } from "@/lib/voice/domain-actions";
import { createAmyAgent } from "./amy-tools";
import { parseDispatchAttributes, parseRoomMetadata, type AmyProcessUserData } from "./metadata";
import { buildAmyVoicePipeline } from "./pipeline";

dotenv.config();

// Accept ELEVENLABS_KEY (Coolify/Telnyx convention) for LiveKit TTS plugin.
if (!process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_KEY?.trim()) {
  process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_KEY.trim();
}

const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME || "transovo-voice-runtime";

export default defineAgent<AmyProcessUserData>({
  entry: async (ctx) => {
    const roomMeta =
      parseRoomMetadata(ctx.room.metadata) ||
      parseDispatchAttributes(
        Object.fromEntries(
          [...ctx.room.remoteParticipants.values()].flatMap((p) =>
            Object.entries(p.attributes || {}),
          ),
        ),
      );

    if (!roomMeta) {
      throw new Error(
        "Missing workspaceId/agentId in room metadata — configure LiveKit SIP dispatch rule",
      );
    }

    const fromParticipant = [...ctx.room.remoteParticipants.values()][0];
    const fromE164 =
      roomMeta.fromE164 ||
      fromParticipant?.attributes?.["sip.phoneNumber"] ||
      fromParticipant?.identity;

    const { callId } = await liveKitRuntimeProvider.bootstrapSession({
      workspaceId: roomMeta.workspaceId,
      agentId: roomMeta.agentId,
      callId: roomMeta.callId,
      fromE164,
      toE164: roomMeta.toE164,
      livekitRoomName: ctx.room.name,
      livekitParticipantId: fromParticipant?.identity,
    });

    const callContext = await bootstrapLiveKitCallContext({
      callId,
      workspaceId: roomMeta.workspaceId,
      agentId: roomMeta.agentId,
      fromE164,
      toE164: roomMeta.toE164,
    });

    ctx.proc.userData = { callContext } satisfies AmyProcessUserData;

    const { stt, llm, tts } = buildAmyVoicePipeline();
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
