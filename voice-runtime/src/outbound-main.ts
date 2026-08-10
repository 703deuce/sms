import dotenv from "dotenv";
import { cli, defineAgent, ServerOptions, voice } from "@livekit/agents";
import { SipClient } from "livekit-server-sdk";
import { fileURLToPath } from "node:url";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type { OutboundJobMetadata } from "@/lib/voice/outbound/types";
import {
  mapSipErrorToTelephonyOutcome,
  persistLeadQualificationResult,
  TRANSOVO_OUTBOUND_AGENT_NAME,
} from "@/lib/voice/outbound/outbound-call-service";
import { ensureLiveKitOutboundTrunk } from "@/lib/telephony/provisioning/livekit/outbound-trunk";
import { appendTraceEvent } from "@/lib/voice/workflow-engine/trace";
import { createNewLeadQualificationAgent } from "./outbound/new-lead-qualification-agent";
import { QualifyLeadTask } from "./outbound/qualify-lead-task";
import { buildQualificationCloseLine } from "./outbound/outbound-messages";
import type { OutboundLeadUserData } from "./outbound/userdata";
import { buildAmyVoicePipeline, describePipelineConfig } from "./pipeline";
import { applyVoiceRuntimeEnvAliases } from "./env-aliases";
import { attachLatencyInstrumentation } from "./latency-instrumentation";
import { attachLiveKitTranscriptPersistence } from "./transcript-persistence";
import { attachOutputGain, resolveLiveKitOutputGainDb } from "./output-gain";
import { buildAmyTurnHandling, describeTurnHandlingConfig, getPreemptiveConfigForInstrumentation } from "./turn-config";
import { liveKitRuntimeProvider } from "@/lib/voice/runtime-provider/livekit";

dotenv.config();
applyVoiceRuntimeEnvAliases();

function parseJobMetadata(raw: string | undefined): OutboundJobMetadata {
  if (!raw?.trim()) {
    throw new Error("Outbound job missing metadata");
  }
  const parsed = JSON.parse(raw) as OutboundJobMetadata;
  if (parsed.kind !== "outbound_lead_qualification") {
    throw new Error(`Unexpected outbound job kind: ${String((parsed as { kind?: string }).kind)}`);
  }
  return parsed;
}

export default defineAgent<OutboundLeadUserData>({
  entry: async (ctx) => {
    const job = parseJobMetadata(ctx.job.metadata);
    const prisma = getPrisma();

    await appendTraceEvent(job.callId, {
      kind: "agent_ready",
      detail: { room: ctx.room.name },
    }).catch(() => undefined);

    const agentRow = await prisma.voiceAgent.findFirst({
      where: { id: job.agentId, workspaceId: job.workspaceId },
      select: { draftConfig: true, name: true },
    });
    const agentConfig = parseVoiceAgentConfig(agentRow?.draftConfig);
    const outputGainDb = resolveLiveKitOutputGainDb(agentConfig.voiceLanguage?.outputGainDb);

    const messaging = await prisma.workspaceMessagingSettings.findUnique({
      where: { workspaceId: job.workspaceId },
      select: { timezone: true },
    });
    const timezone = String(
      agentConfig.dynamicVariables?.business_timezone ||
        messaging?.timezone ||
        "America/New_York",
    );
    const businessName =
      job.qualification.businessName ||
      String(agentConfig.dynamicVariables?.business_name || "").trim() ||
      agentRow?.name?.trim() ||
      "our team";

    await prisma.voiceCall.update({
      where: { id: job.callId },
      data: {
        status: "IN_PROGRESS",
        answeredAt: new Date(),
        metadata: {
          source: "livekit_outbound",
          livekitRoomName: ctx.room.name,
          outbound: job,
        } as object,
      },
    });

    const userData: OutboundLeadUserData = {
      workspaceId: job.workspaceId,
      agentId: job.agentId,
      callId: job.callId,
      businessName,
      timezone,
      job,
      qualification: job.qualification,
      collectedFields: {},
      interested: true,
      qualificationComplete: false,
    };
    ctx.proc.userData = userData;

    const { stt, llm, tts, config, sttConfig } = buildAmyVoicePipeline();
    console.log(
      JSON.stringify({
        source: "transovo-outbound-voice-runtime",
        event: "pipeline_config",
        callId: job.callId,
        profile: "outbound_lead_qualification",
        pipeline: describePipelineConfig(config, sttConfig),
        turnHandling: describeTurnHandlingConfig(),
        outputGainDb,
      }),
    );

    const agent = createNewLeadQualificationAgent(businessName);
    const session = new voice.AgentSession<OutboundLeadUserData>({
      stt,
      llm,
      tts,
      turnHandling: buildAmyTurnHandling(),
      maxToolSteps: Number(process.env.VOICE_MAX_TOOL_STEPS?.trim()) || 8,
      userData,
    });

    attachLatencyInstrumentation(session, {
      callId: job.callId,
      preemptiveConfig: getPreemptiveConfigForInstrumentation(),
      ttsConfig: {
        preset: config.ttsPreset || null,
        provider: config.ttsProvider,
        model: config.ttsModel,
        voice: config.ttsVoice,
      },
    });

    attachLiveKitTranscriptPersistence(session, {
      workspaceId: job.workspaceId,
      callId: job.callId,
    });

    ctx.addShutdownCallback(async () => {
      if (!userData.qualificationComplete) {
        await persistLeadQualificationResult({
          callId: job.callId,
          workspaceId: job.workspaceId,
          result: {
            leadId: job.lead.leadId || null,
            contactId: job.lead.contactId || null,
            outcome: "NOT_STARTED",
            telephonyOutcome: "CANCELLED",
            collectedFields: userData.collectedFields,
            summary: "Call ended before qualification completed.",
            nextAction: "Review call",
            completedAt: new Date().toISOString(),
          },
          telephonyOutcome: "CANCELLED",
        });
      }
      await liveKitRuntimeProvider.endSession(job.callId);
    });

    // Agent-first: session live before PSTN dial (LiveKit recommended outbound pattern).
    await session.start({ agent, room: ctx.room });

    if (session.room_io?.setParticipant) {
      session.room_io.setParticipant(job.calleeParticipantIdentity);
    }

    await appendTraceEvent(job.callId, {
      kind: "sip_dial_started",
      detail: {
        destination: job.destinationE164,
        callerId: job.callerIdE164,
      },
    }).catch(() => undefined);

    const { requireLiveKitEnv } = await import("@/lib/voice/runtime-provider/config");
    const { url, apiKey, apiSecret } = requireLiveKitEnv();
    const sip = new SipClient(url, apiKey, apiSecret);

    const { trunk } = await ensureLiveKitOutboundTrunk({ callerIdE164: job.callerIdE164 });
    const trunkId = trunk.sipTrunkId;
    if (!trunkId) {
      throw new Error("LiveKit outbound trunk missing sipTrunkId");
    }

    try {
      await sip.createSipParticipant(
        trunkId,
        job.destinationE164,
        ctx.room.name!,
        {
          participantIdentity: job.calleeParticipantIdentity,
          participantName: job.lead.leadName || "Lead",
          fromNumber: job.callerIdE164,
          waitUntilAnswered: true,
          ringingTimeout: 45,
        },
      );

      userData.callAnsweredAt = Date.now();
      await appendTraceEvent(job.callId, {
        kind: "call_answered",
        detail: { at: new Date().toISOString() },
      }).catch(() => undefined);

      await prisma.voiceCall.update({
        where: { id: job.callId },
        data: { status: "IN_PROGRESS", answeredAt: new Date() },
      });

      userData.firstAudioAt = Date.now();
      await appendTraceEvent(job.callId, {
        kind: "qualification_started",
        detail: {
          answerToFirstAudioMs: userData.callAnsweredAt
            ? userData.firstAudioAt - userData.callAnsweredAt
            : null,
        },
      }).catch(() => undefined);

      await new QualifyLeadTask(session, { chatCtx: session.chatCtx }).run();

      const closeLine = buildQualificationCloseLine(businessName);
      await session.generateReply({
        instructions:
          `If qualification is complete and you have not already said goodbye, say: "${closeLine}" ` +
          "Then call end_call.",
        toolChoice: "auto",
        allowInterruptions: false,
      });
    } catch (err) {
      const telephonyOutcome = mapSipErrorToTelephonyOutcome(err);
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        JSON.stringify({
          source: "transovo-outbound-voice-runtime",
          event: "sip_dial_failed",
          callId: job.callId,
          telephonyOutcome,
          error: message,
        }),
      );

      await prisma.voiceCall.update({
        where: { id: job.callId },
        data: {
          status: "FAILED",
          errorMessage: message,
          endedAt: new Date(),
        },
      });

      await persistLeadQualificationResult({
        callId: job.callId,
        workspaceId: job.workspaceId,
        result: {
          leadId: job.lead.leadId || null,
          contactId: job.lead.contactId || null,
          outcome: "NOT_STARTED",
          telephonyOutcome,
          collectedFields: {},
          summary: `Outbound dial failed: ${message}`,
          nextAction: "Retry outbound call",
          completedAt: new Date().toISOString(),
        },
        telephonyOutcome,
      });

      session.shutdown({ reason: "dial_failed" });
      return;
    }

    if (session.output.audio) {
      session.output.audio = attachOutputGain(session.output.audio, outputGainDb) ?? session.output.audio;
    }
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(
    new ServerOptions({
      agent: fileURLToPath(import.meta.url),
      agentName: TRANSOVO_OUTBOUND_AGENT_NAME,
    }),
  );
}
