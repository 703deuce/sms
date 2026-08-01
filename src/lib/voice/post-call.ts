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
        actionItems: (insight.actionItems || []) as object,
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

  const missedStatuses = ["NO_ANSWER", "BUSY", "CANCELLED"];
  const isMissed =
    missedStatuses.includes(call.status) ||
    (!call.answeredAt && !call.voicemailDetected && !call.appointmentBooked);

  if (call.contactId) {
    await emitVoiceAutomationEvents(call);
    if (isMissed) {
      await emitAutomationEvent(call.workspaceId, "call.missed", call.contactId, {
        callId: call.id,
        status: call.status,
        outcome: call.outcome,
      }).catch(() => undefined);
    }
    await emitAutomationEvent(
      call.workspaceId,
      "call.completed",
      call.contactId,
      { callId: call.id, outcome: call.outcome },
    ).catch(() => undefined);
  }

  // CRM framework — one call lifecycle + transcript/summary updates.
  try {
    const {
      publishCallCompleted,
      publishTranscriptReady,
      publishAiSummaryReady,
      publishVoicemailReceived,
    } = await import("@/lib/crm/events");
    const direction =
      isMissed || call.voicemailDetected
        ? "missed"
        : call.direction === "OUTBOUND" || call.direction === "outbound"
          ? "outbound"
          : "inbound";
    await publishCallCompleted({
      workspaceId: call.workspaceId,
      contactId: call.contactId,
      callId: call.id,
      direction,
      from: call.fromE164,
      to: call.toE164,
      durationSeconds: duration,
      disposition: call.outcome || call.status,
      notes: insight?.summary || null,
    }).catch(() => undefined);

    if (call.voicemailDetected) {
      await publishVoicemailReceived({
        workspaceId: call.workspaceId,
        contactId: call.contactId,
        callId: call.id,
        from: call.fromE164,
        to: call.toE164,
      }).catch(() => undefined);
    }

    const transcriptRow = await prisma.voiceTranscript.findFirst({
      where: { callId: call.id },
    });
    const transcriptText = transcriptRow?.fullText || null;
    if (transcriptText) {
      await publishTranscriptReady({
        workspaceId: call.workspaceId,
        contactId: call.contactId,
        callId: call.id,
        transcriptText,
        aiSummary: insight?.summary || null,
      }).catch(() => undefined);
    }
    if (insight?.summary) {
      await publishAiSummaryReady({
        workspaceId: call.workspaceId,
        contactId: call.contactId,
        callId: call.id,
        aiSummary: insight.summary,
      }).catch(() => undefined);
    }
  } catch {
    // CRM push is optional
  }

  return { ok: true, callId, missed: isMissed };
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

  // Structured heuristic baseline (always available, no external deps).
  const heuristic = {
    summary: text
      ? `Call ${call.direction.toLowerCase()} — ${text.slice(0, 200)}`
      : `Call completed with outcome ${call.outcome || "unknown"}`,
    intent: call.voicemailDetected
      ? "voicemail"
      : call.appointmentBooked
        ? "appointment"
        : qualification.requested_estimate
          ? "quote_request"
          : "general_inquiry",
    sentiment: heuristicSentiment(text),
    isLead,
    leadScore,
    qualification,
    topics: heuristicTopics(text),
    objections: heuristicObjections(text),
    actionItems: call.appointmentBooked ? ["Appointment booked — send confirmation"] : [],
    needsReview: leadScore > 0 && leadScore < 40,
    confidence: text ? 0.75 : 0.4,
  };

  // Upgrade with an LLM summary when a transcript and OpenAI key are available.
  if (text.trim().length > 40) {
    try {
      const llm = await llmInsights(text, call.direction);
      if (llm) {
        return {
          ...heuristic,
          summary: llm.summary || heuristic.summary,
          intent: llm.intent || heuristic.intent,
          sentiment: llm.sentiment || heuristic.sentiment,
          topics: llm.topics?.length ? llm.topics : heuristic.topics,
          objections: llm.objections?.length ? llm.objections : heuristic.objections,
          actionItems: llm.actionItems?.length ? llm.actionItems : heuristic.actionItems,
          confidence: 0.9,
        };
      }
    } catch (err) {
      console.warn("[post-call] LLM insight failed, using heuristic", err);
    }
  }

  return heuristic;
}

function heuristicSentiment(text: string): string {
  if (!text) return "neutral";
  const positive = /(thank|great|perfect|awesome|appreciate|happy|sounds good|wonderful)/i.test(text);
  const negative = /(angry|upset|frustrat|terrible|cancel|refund|complaint|not happy|disappointed)/i.test(text);
  if (negative && !positive) return "negative";
  if (positive && !negative) return "positive";
  return "neutral";
}

function heuristicTopics(text: string): string[] {
  const topics: string[] = [];
  const map: Record<string, RegExp> = {
    pricing: /price|cost|quote|estimate|\$/i,
    scheduling: /appointment|schedule|book|calendar|reschedule/i,
    support: /help|issue|problem|broken|repair|fix/i,
    billing: /invoice|bill|payment|charge|refund/i,
    availability: /available|hours|open|when can/i,
  };
  for (const [topic, re] of Object.entries(map)) {
    if (re.test(text)) topics.push(topic);
  }
  return topics;
}

function heuristicObjections(text: string): string[] {
  const objections: string[] = [];
  if (/too expensive|too much|can'?t afford|out of budget/i.test(text)) objections.push("Price concern");
  if (/think about it|call.*back|not sure|maybe later/i.test(text)) objections.push("Needs time to decide");
  if (/competitor|another company|someone else/i.test(text)) objections.push("Considering alternatives");
  return objections;
}

async function llmInsights(text: string, direction: string) {
  const { openAiChatCompletion, getOpenAiApiKey } = await import("@/lib/ai/openai");
  if (!getOpenAiApiKey()) return null;

  const system =
    "You analyze phone call transcripts and return ONLY strict JSON with keys: " +
    "summary (string, 1-2 sentences), intent (short snake_case string), " +
    "sentiment (positive|neutral|negative), topics (string array), " +
    "objections (string array), actionItems (string array). No markdown.";
  const user = `Direction: ${direction}\nTranscript:\n${text.slice(0, 6000)}`;

  const raw = await openAiChatCompletion(system, user, { temperature: 0.2, maxTokens: 500 });
  if (!raw) return null;

  const jsonText = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(jsonText) as {
    summary?: string;
    intent?: string;
    sentiment?: string;
    topics?: string[];
    objections?: string[];
    actionItems?: string[];
  };
  return {
    summary: parsed.summary,
    intent: parsed.intent,
    sentiment: ["positive", "neutral", "negative"].includes(parsed.sentiment || "")
      ? parsed.sentiment
      : undefined,
    topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 8) : [],
    objections: Array.isArray(parsed.objections) ? parsed.objections.slice(0, 8) : [],
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 8) : [],
  };
}
