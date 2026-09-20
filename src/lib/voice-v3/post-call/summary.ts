import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceV3PostCallSystemFacts } from "./system-facts";

export type VoiceV3StructuredSummary = {
  headline: string;
  summary: string;
  reasonForCall?: string;
  reasonCategory?: string;
  outcome: string;
  urgency: "NORMAL" | "IMPORTANT" | "URGENT";
  actionRequired: boolean;
  actionItems?: string[];
  knowledgeGapCandidates?: Array<{
    question: string;
    normalizedQuestion: string;
    unanswered: boolean;
    context?: string;
  }>;
};

function outcomeFromFacts(facts: VoiceV3PostCallSystemFacts): string {
  if (facts.screeningOutcome === "UNWANTED_SOLICITATION") return "SOLICITOR";
  const o = String(facts.outcome || "").toLowerCase();
  if (facts.appointmentBooked || o.includes("booked")) return "APPOINTMENT_BOOKED";
  if (facts.callbackRequested || o.includes("callback")) return "CALLBACK_REQUESTED";
  if (facts.transferFailed) return "TRANSFER_FAILED";
  if (facts.transferred && facts.transferConnected) return "TRANSFER_CONNECTED";
  if (o.includes("emergency")) return "EMERGENCY_ESCALATED";
  if (o.includes("message")) return "MESSAGE_TAKEN";
  if (o.includes("faq") || o.includes("information")) return "FAQ_RESOLVED";
  if (o.includes("spam")) return "SPAM";
  return "OTHER";
}

export async function ensureVoiceV3CallSummary(input: {
  callId: string;
  workspaceId: string;
  facts: VoiceV3PostCallSystemFacts;
  transcriptPlainText: string;
}): Promise<VoiceV3StructuredSummary> {
  const prisma = getPrisma();
  const existing = await prisma.voiceConversationInsight.findFirst({
    where: { callId: input.callId, workspaceId: input.workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const custom = (existing?.customFields || {}) as Record<string, unknown>;
  if (custom.voiceV3StructuredSummary && existing?.summary) {
    return custom.voiceV3StructuredSummary as VoiceV3StructuredSummary;
  }

  const deterministicOutcome = outcomeFromFacts(input.facts);
  const urgency: VoiceV3StructuredSummary["urgency"] =
    deterministicOutcome === "EMERGENCY_ESCALATED" || input.facts.transferFailed
      ? "URGENT"
      : deterministicOutcome === "CALLBACK_REQUESTED"
        ? "IMPORTANT"
        : "NORMAL";

  const actionRequired =
    deterministicOutcome === "CALLBACK_REQUESTED" ||
    deterministicOutcome === "TRANSFER_FAILED" ||
    deterministicOutcome === "EMERGENCY_ESCALATED";

  let structured: VoiceV3StructuredSummary = {
    headline: `After-hours call — ${deterministicOutcome.replace(/_/g, " ").toLowerCase()}`,
    summary: input.transcriptPlainText
      ? input.transcriptPlainText.slice(0, 500)
      : `Call completed (${deterministicOutcome}).`,
    reasonForCall: undefined,
    outcome: deterministicOutcome,
    urgency,
    actionRequired,
    actionItems: actionRequired ? ["Review call and follow up if needed"] : [],
    knowledgeGapCandidates: [],
  };

  const text = input.transcriptPlainText.trim();
  if (text.length > 40 && process.env.OPENAI_API_KEY?.trim()) {
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const systemFactsJson = JSON.stringify(input.facts, null, 2);
      const completion = await client.chat.completions.create({
        model: process.env.VOICE_V3_POST_CALL_SUMMARY_MODEL?.trim() || "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You summarize completed after-hours business calls. Use SYSTEM FACTS as authoritative truth for actions. Never claim booking/transfer/callback unless SYSTEM FACTS supports it. Return JSON with headline, summary, reasonForCall, reasonCategory, urgency, actionRequired, actionItems, knowledgeGapCandidates (only unanswered business questions Amy could not answer from approved knowledge).`,
          },
          {
            role: "user",
            content: `SYSTEM FACTS:\n${systemFactsJson}\n\nTRANSCRIPT:\n${text.slice(0, 12000)}`,
          },
        ],
      });
      const raw = completion.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw) as Partial<VoiceV3StructuredSummary>;
      structured = {
        ...structured,
        headline: parsed.headline || structured.headline,
        summary: parsed.summary || structured.summary,
        reasonForCall: parsed.reasonForCall,
        reasonCategory: parsed.reasonCategory,
        urgency: parsed.urgency || structured.urgency,
        actionRequired: parsed.actionRequired ?? structured.actionRequired,
        actionItems: parsed.actionItems?.length ? parsed.actionItems : structured.actionItems,
        knowledgeGapCandidates: parsed.knowledgeGapCandidates || [],
        outcome: deterministicOutcome,
      };
    } catch (err) {
      console.warn("[voice-v3-post-call] summary LLM failed", err);
    }
  }

  const data = {
    summary: structured.summary,
    intent: structured.reasonCategory || structured.outcome,
    sentiment: null,
    isLead: null,
    leadScore: null,
    actionItems: structured.actionItems || [],
    customFields: {
      voiceV3StructuredSummary: structured,
      reasonForCall: structured.reasonForCall,
      reasonCategory: structured.reasonCategory,
      voiceV3Outcome: structured.outcome,
      urgency: structured.urgency,
      actionRequired: structured.actionRequired,
    },
  };

  if (existing) {
    await prisma.voiceConversationInsight.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.voiceConversationInsight.create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        ...data,
      },
    });
  }

  return structured;
}
