import { getPrisma } from "@/lib/db";
import { enrollInAutomation } from "@/lib/automations/enroll";
import { emitPlatformEvent } from "@/lib/platform/events";
import { emitVoiceAutomationEvents } from "./automation-events";
import { recordVoiceUsage } from "./usage";
import { parseVoiceAgentConfig } from "./types";
import { resolveTransferInsightFields, resolveMessageTakenInsight } from "./routing-action-resolve";

export async function processPostCall(callId: string) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (!call) return { ok: false };

  if (call.telnyxConversationId) {
    const { syncTranscriptFromTelnyxConversation } = await import("@/lib/voice/transcript-sync");
    await syncTranscriptFromTelnyxConversation({
      workspaceId: call.workspaceId,
      callId: call.id,
      telnyxConversationId: call.telnyxConversationId,
    }).catch(() => undefined);
  }

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
  const extractionFields = config?.postCall?.extractionFields || [];

  if (insight) {
    const extractedCustom: Record<string, unknown> = {
      urgency: insight.urgency,
      ...(insight.extractedFields || {}),
    };
    // Always surface configured extraction field keys, even when null.
    for (const key of extractionFields) {
      if (!(key in extractedCustom)) {
        extractedCustom[key] =
          insight.extractedFields?.[key] !== undefined
            ? insight.extractedFields[key]
            : null;
      }
    }

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
        customFields: extractedCustom as object,
        needsReview: insight.needsReview || insight.urgency === "high",
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

  // Always emit completion events so wait_for_call_result can resume by callId
  // even when the caller contact was never created.
  if (call.contactId) {
    await emitVoiceAutomationEvents(call);
  }
  if (isMissed) {
    await emitPlatformEvent({
      workspaceId: call.workspaceId,
      type: "CALL_MISSED",
      contactId: call.contactId || undefined,
      agentId: call.agentId,
      callId: call.id,
      payload: { status: call.status, outcome: call.outcome },
      idempotencyKey: `call-missed:${call.id}`,
    }).catch(() => undefined);

    try {
      const { processMissedInboundCall } = await import(
        "@/lib/agents/missed-call-text-back/process"
      );
      await processMissedInboundCall({
        workspaceId: call.workspaceId,
        callerE164: call.fromE164,
        businessE164: call.toE164,
        phoneNumberId: call.phoneNumberId,
        voiceCallId: call.id,
        contactId: call.contactId,
        providerCallId: call.telnyxCallControlId,
        call: {
          direction: call.direction,
          status: call.status,
          disposition: call.outcome,
          answeredAt: call.answeredAt,
          voicemailDetected: call.voicemailDetected,
        },
      });
    } catch (err) {
      console.warn("[post-call] John MCTB process failed", call.id, err);
    }
  }
  await emitPlatformEvent({
    workspaceId: call.workspaceId,
    type: "CALL_COMPLETED",
    contactId: call.contactId || undefined,
    agentId: call.agentId,
    callId: call.id,
    payload: {
      outcome: call.outcome,
      status: call.status,
      callStatus: call.status,
      answered: Boolean(call.answeredAt),
      appointmentBooked: Boolean(call.appointmentBooked),
      transferCompleted: Boolean(call.transferred),
      leadCaptured: Boolean(insight?.isLead),
      voicemailLeft: Boolean(call.voicemailDetected),
      callerHungUp: String(call.outcome || "")
        .toLowerCase()
        .includes("hang"),
      duration,
      summary: insight?.summary || null,
      transcriptId: call.id,
      extractedFields: insight?.extractedFields || null,
      phoneNumberId: call.phoneNumberId,
    },
    idempotencyKey: `call-completed:${call.id}`,
  }).catch(() => undefined);
  await emitPlatformEvent({
    workspaceId: call.workspaceId,
    type: "AI_CALL_COMPLETED",
    contactId: call.contactId || undefined,
    agentId: call.agentId,
    callId: call.id,
    payload: {
      outcome: call.outcome,
      status: call.status,
      callStatus: call.status,
      answered: Boolean(call.answeredAt),
      appointmentBooked: Boolean(call.appointmentBooked),
      transferCompleted: Boolean(call.transferred),
      leadCaptured: Boolean(insight?.isLead),
      voicemailLeft: Boolean(call.voicemailDetected),
      duration,
      summary: insight?.summary || null,
      transcriptReady: true,
      extractedFields: insight?.extractedFields || null,
      phoneNumberId: call.phoneNumberId,
    },
    idempotencyKey: `ai-call-completed:${call.id}`,
  }).catch(() => undefined);

  if (call.contactId) {
    // Agent → Automation: post-call / outcome-rule start.
    if (agent?.postCallAutomationId) {
      await enrollInAutomation({
        workspaceId: call.workspaceId,
        flowId: agent.postCallAutomationId,
        contactId: call.contactId,
      }).catch(() => undefined);
    } else if (agent?.fallbackAutomationId && isMissed) {
      await enrollInAutomation({
        workspaceId: call.workspaceId,
        flowId: agent.fallbackAutomationId,
        contactId: call.contactId,
      }).catch(() => undefined);
    }

    // Outcome rule from draftConfig.postCall.startAutomationOnOutcomes
    const outcomeRules =
      (config?.postCall as { startAutomationOnOutcomes?: Record<string, string> } | null)
        ?.startAutomationOnOutcomes || {};
    const outcomeKey = String(call.outcome || insight?.intent || "").toLowerCase();
    const ruleFlowId = outcomeKey ? outcomeRules[outcomeKey] : undefined;
    if (ruleFlowId) {
      await enrollInAutomation({
        workspaceId: call.workspaceId,
        flowId: ruleFlowId,
        contactId: call.contactId,
      }).catch(() => undefined);
    }
  }

  // CRM framework — one call lifecycle + transcript/summary updates.
  try {
    const {
      publishCallCompleted,
      publishTranscriptReady,
      publishAiSummaryReady,
      publishVoicemailReceived,
      publishLeadCreated,
      publishAppointmentBooked,
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

    if (insight?.isLead && call.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: call.contactId, workspaceId: call.workspaceId },
      });
      await publishLeadCreated({
        workspaceId: call.workspaceId,
        contactId: call.contactId,
        callId: call.id,
        leadId: call.contactId,
        firstName: contact?.firstName,
        lastName: contact?.lastName,
        phone: contact?.phone || call.fromE164 || call.toE164,
        email: contact?.email,
        company: contact?.company,
        status: "Open",
      }).catch(() => undefined);
    }

    if (call.appointmentBooked) {
      const appt = await prisma.voiceAppointment.findFirst({
        where: { callId: call.id, workspaceId: call.workspaceId },
        orderBy: { createdAt: "desc" },
      });
      if (appt) {
        await publishAppointmentBooked({
          workspaceId: call.workspaceId,
          contactId: call.contactId,
          appointmentId: appt.id,
          callId: call.id,
          serviceName: appt.serviceName,
          startsAt: appt.startsAt,
          endsAt: appt.endsAt,
          timezone: appt.timezone,
        }).catch(() => undefined);
      }
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

  const urgency = heuristicUrgency(text, call);

  // Structured heuristic baseline (always available, no external deps).
  const extractionFields = config?.postCall?.extractionFields || [];
  const heuristicExtracted = heuristicExtractedFields(text, call, extractionFields);

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
    urgency,
    isLead,
    leadScore,
    qualification,
    topics: heuristicTopics(text),
    objections: heuristicObjections(text),
    actionItems: call.appointmentBooked ? ["Appointment booked — send confirmation"] : [],
    needsReview: leadScore > 0 && leadScore < 40 || urgency === "high",
    confidence: text ? 0.75 : 0.4,
    extractedFields: heuristicExtracted,
  };

  // Upgrade with an LLM summary when a transcript and OpenAI key are available.
  if (text.trim().length > 40) {
    try {
      const llm = await llmInsights(text, call.direction, extractionFields);
      if (llm) {
        return {
          ...heuristic,
          summary: llm.summary || heuristic.summary,
          intent: llm.intent || heuristic.intent,
          sentiment: llm.sentiment || heuristic.sentiment,
          urgency: llm.urgency || heuristic.urgency,
          topics: llm.topics?.length ? llm.topics : heuristic.topics,
          objections: llm.objections?.length ? llm.objections : heuristic.objections,
          actionItems: llm.actionItems?.length ? llm.actionItems : heuristic.actionItems,
          confidence: 0.9,
          extractedFields: {
            ...heuristicExtracted,
            ...(llm.fields || {}),
          },
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

function heuristicUrgency(
  text: string,
  call: { appointmentBooked: boolean; transferred: boolean },
): "high" | "normal" | "low" {
  if (
    /(urgent|asap|emergency|right now|immediately|can't wait|today only)/i.test(text) ||
    call.transferred
  ) {
    return "high";
  }
  if (call.appointmentBooked || /(next week|whenever|no rush|flexible)/i.test(text)) {
    return "low";
  }
  return "normal";
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

function heuristicExtractedFields(
  text: string,
  call: {
    appointmentBooked: boolean;
    transferred: boolean;
    voicemailDetected: boolean;
    outcome?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  fields: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of fields) {
    switch (key) {
      case "appointment_booked":
        out[key] = call.appointmentBooked;
        break;
      case "transfer_attempted":
      case "transfer_successful": {
        const transfer = resolveTransferInsightFields({
          text,
          transferred: call.transferred,
          outcome: call.outcome,
        });
        out[key] = transfer[key];
        break;
      }
      case "message_taken":
        out[key] = resolveMessageTakenInsight({
          text,
          outcome: call.outcome,
          metadata: call.metadata,
        });
        break;
      case "outcome":
        out[key] = call.outcome || null;
        break;
      case "caller_phone": {
        const m = text.match(/\+?\d[\d\s().-]{8,}\d/);
        out[key] = m ? m[0].replace(/\s+/g, "") : null;
        break;
      }
      case "caller_name": {
        const m = text.match(/(?:my name is|this is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
        out[key] = m?.[1] || null;
        break;
      }
      default:
        out[key] = null;
    }
  }
  return out;
}

async function llmInsights(text: string, direction: string, extractionFields: string[] = []) {
  const { openAiChatCompletion, getOpenAiApiKey } = await import("@/lib/ai/openai");
  if (!getOpenAiApiKey()) return null;

  const fieldHint = extractionFields.length
    ? ` Also include a "fields" object with these keys (use null when unknown): ${extractionFields.join(", ")}.`
    : "";

  const system =
    "You analyze phone call transcripts and return ONLY strict JSON with keys: " +
    "summary (string, 1-2 sentences), intent (short snake_case string), " +
    "sentiment (positive|neutral|negative), urgency (high|normal|low), topics (string array), " +
    "objections (string array), actionItems (string array)." +
    fieldHint +
    " No markdown.";
  const user = `Direction: ${direction}\nTranscript:\n${text.slice(0, 6000)}`;

  const raw = await openAiChatCompletion(system, user, { temperature: 0.2, maxTokens: 700 });
  if (!raw) return null;

  const jsonText = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(jsonText) as Record<string, unknown> & {
    summary?: string;
    intent?: string;
    sentiment?: string;
    urgency?: string;
    topics?: string[];
    objections?: string[];
    actionItems?: string[];
    fields?: Record<string, unknown>;
  };

  const fields: Record<string, unknown> = {};
  const nested =
    parsed.fields && typeof parsed.fields === "object" && !Array.isArray(parsed.fields)
      ? parsed.fields
      : {};
  for (const key of extractionFields) {
    if (nested[key] !== undefined) {
      fields[key] = nested[key];
    } else if (parsed[key] !== undefined && !["summary", "intent", "sentiment", "urgency", "topics", "objections", "actionItems", "fields"].includes(key)) {
      fields[key] = parsed[key];
    }
  }

  return {
    summary: parsed.summary,
    intent: parsed.intent,
    sentiment: ["positive", "neutral", "negative"].includes(parsed.sentiment || "")
      ? parsed.sentiment
      : undefined,
    urgency: ["high", "normal", "low"].includes(parsed.urgency || "")
      ? (parsed.urgency as "high" | "normal" | "low")
      : undefined,
    topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 8) : [],
    objections: Array.isArray(parsed.objections) ? parsed.objections.slice(0, 8) : [],
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 8) : [],
    fields,
  };
}
