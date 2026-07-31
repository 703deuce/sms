import { getPrisma } from "@/lib/db";
import { emitAutomationEvent } from "@/lib/automations/events";
import { emitVoiceAutomationEvents } from "./automation-events";
import { recordVoiceUsage } from "./usage";
import { parseVoiceAgentConfig } from "./types";

export async function processPostCall(callId: string) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (!call) return { ok: false };

  const agent = call.agentId
    ? await prisma.voiceAgent.findUnique({ where: { id: call.agentId } })
    : null;

  let config = null;
  if (call.agentVersionId) {
    const ver = await prisma.voiceAgentVersion.findUnique({
      where: { id: call.agentVersionId },
    });
    config = ver ? parseVoiceAgentConfig(ver.config) : null;
  } else if (agent?.draftConfig) {
    config = parseVoiceAgentConfig(agent.draftConfig);
  }

  const duration =
    call.durationSeconds ??
    (call.endedAt && call.startedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000,
          ),
        )
      : 0);

  const aiMinutes = call.aiMinutes || duration / 60;
  const telephonyMinutes = duration / 60;

  await recordVoiceUsage({
    workspaceId: call.workspaceId,
    callId: call.id,
    agentId: call.agentId,
    campaignId: call.campaignId,
    telephonyMinutes,
    aiMinutes,
    isTest: call.isTest,
  });

  // Generate insights (Telnyx or internal stub)
  const insight = await generateCallInsights(call, config);

  if (insight) {
    await prisma.voiceConversationInsight.create({
      data: {
        workspaceId: call.workspaceId,
        callId: call.id,
        summary: insight.summary,
        intent: insight.intent,
        sentiment: insight.sentiment,
        isLead: insight.isLead,
        leadScore: insight.leadScore,
        qualification: insight.qualification as object,
        topics: insight.topics as object,
        objections: insight.objections as object,
        needsReview: insight.needsReview,
        confidence: insight.confidence,
      },
    });

    if (insight.leadScore != null) {
      await prisma.voiceCall.update({
        where: { id: call.id },
        data: { leadScore: insight.leadScore },
      });
    }
  }

  if (agent) {
    await prisma.voiceAgent.update({
      where: { id: agent.id },
      data: { callsHandled: { increment: 1 } },
    });
  }

  if (call.contactId) {
    await emitVoiceAutomationEvents(call);
    await emitAutomationEvent(
      call.workspaceId,
      "call.completed",
      call.contactId,
      { callId: call.id, outcome: call.outcome },
    ).catch(() => undefined);
  }

  return { ok: true, callId };
}

async function generateCallInsights(
  call: {
    id: string;
    outcome?: string | null;
    voicemailDetected: boolean;
    transferred: boolean;
    appointmentBooked: boolean;
    direction: string;
  },
  config: ReturnType<typeof parseVoiceAgentConfig> | null,
) {
  const transcript = await getPrisma().voiceTranscript.findFirst({
    where: { callId: call.id },
  });

  const text = transcript?.fullText || "";
  const qualification: Record<string, boolean> = {
    service_requested: /service|repair|install|help/i.test(text),
    in_service_area: /area|zip|location/i.test(text),
    timeline_provided: /today|tomorrow|week|asap|soon/i.test(text),
    requested_estimate: /quote|estimate|price|cost/i.test(text),
    budget_identified: /budget|\$|dollar/i.test(text),
    appointment_booked: call.appointmentBooked,
  };

  let leadScore = 0;
  const rules = config?.postCall?.scoringRules || [];
  for (const rule of rules) {
    if (qualification[rule.field]) leadScore += rule.points;
  }

  const isLead = leadScore >= 40 && !call.voicemailDetected;

  return {
    summary: text
      ? `Call ${call.direction.toLowerCase()} — ${text.slice(0, 200)}`
      : `Call completed with outcome ${call.outcome || "unknown"}`,
    intent: call.voicemailDetected ? "voicemail" : "general_inquiry",
    sentiment: "neutral",
    isLead,
    leadScore,
    qualification,
    topics: [],
    objections: [],
    needsReview: leadScore > 0 && leadScore < 40,
    confidence: text ? 0.75 : 0.4,
  };
}
