import { llm, voice } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import type { ReceptionistCompiledSnapshot } from "@/lib/voice/receptionist/types";
import { withHybridStreamingAgentOptions } from "../../hybrid-streaming-tts-node";
import type { FrontDeskUserData } from "../userdata";
import { buildReceptionistTools } from "./receptionist-tools";

function policyLines(snapshot: ReceptionistCompiledSnapshot): string[] {
  const lines: string[] = [];
  const conv = snapshot.conversationBehavior as {
    responseLength?: string;
    style?: string;
    allowInterrupt?: boolean;
    confirmImportantDetails?: boolean;
    avoidDuplicateQuestions?: boolean;
    fillerSpeech?: string;
  } | undefined;

  if (conv?.responseLength === "concise") {
    lines.push("Keep replies short — one or two sentences unless the caller needs more detail. ");
  } else if (conv?.responseLength === "detailed") {
    lines.push("You may give fuller explanations when helpful, but stay conversational. ");
  }
  if (conv?.style === "casual") {
    lines.push("Use casual, warm phrasing — contractions and friendly language are fine. ");
  } else if (conv?.style === "friendly") {
    lines.push("Sound warm and approachable while staying professional. ");
  }
  if (conv?.confirmImportantDetails) {
    lines.push("Confirm important details like times, phone numbers, and names before acting. ");
  }
  if (conv?.avoidDuplicateQuestions) {
    lines.push("Do not ask for information you already collected on this call. ");
  }
  if (conv?.fillerSpeech === "minimal") {
    lines.push("Use minimal filler words. ");
  } else if (conv?.fillerSpeech === "off") {
    lines.push("Avoid filler words and transition phrases. ");
  }

  const booking = snapshot.bookingPolicy as {
    askPreferredDayFirst?: boolean;
    confirmDateTimeVerbally?: boolean;
    slotsToOffer?: number;
    minimumNoticeHours?: number;
    offerEarliestAvailability?: boolean;
  } | undefined;
  if (snapshot.capabilities.includes("book_appointments") && booking) {
    if (booking.askPreferredDayFirst) {
      lines.push("When booking, ask what day or time works before listing slots. ");
    }
    if (booking.offerEarliestAvailability) {
      lines.push("When the caller has no preference, offer the earliest available slots first. ");
    }
    if (booking.confirmDateTimeVerbally) {
      lines.push("Always confirm the chosen date and time verbally before booking. ");
    }
    if (booking.slotsToOffer) {
      lines.push(`Offer up to ${booking.slotsToOffer} time options at a time. `);
    }
    if (booking.minimumNoticeHours) {
      lines.push(`Do not offer slots sooner than ${booking.minimumNoticeHours} hours from now. `);
    }
  }

  const knowledge = snapshot.knowledgePolicy as {
    approvedKnowledgeOnly?: boolean;
    allowGeneralAnswers?: boolean;
    whenUncertain?: string;
  } | undefined;
  if (knowledge?.approvedKnowledgeOnly) {
    lines.push("Only answer business questions using get_business_answer — do not invent facts. ");
  }
  if (knowledge?.allowGeneralAnswers) {
    lines.push("You may answer general business questions conversationally when appropriate. ");
  }
  if (knowledge?.whenUncertain === "take_message") {
    lines.push("If you are unsure, offer to take a message for the team. ");
  } else if (knowledge?.whenUncertain === "transfer") {
    lines.push("If you are unsure, offer to transfer to a team member. ");
  } else if (knowledge?.whenUncertain === "say_unknown") {
    lines.push("If you are unsure, say you do not have that information. ");
  }

  const fallback = snapshot.fallbackPolicy as {
    maxMisunderstandAttempts?: number;
    onMisunderstand?: string;
    onBookingFail?: string;
    onTransferFail?: string;
  } | undefined;
  if (fallback?.maxMisunderstandAttempts) {
    lines.push(
      `After ${fallback.maxMisunderstandAttempts} failed attempts to understand, ${fallback.onMisunderstand === "take_message" ? "take a message" : fallback.onMisunderstand === "transfer" ? "offer a transfer" : "rephrase once more"}. `,
    );
  }
  if (fallback?.onBookingFail === "take_message") {
    lines.push("If booking fails, apologize and take a message for follow-up. ");
  } else if (fallback?.onBookingFail === "follow_up") {
    lines.push("If booking fails, tell the caller someone will follow up shortly. ");
  }
  if (fallback?.onTransferFail === "take_message") {
    lines.push("If transfer fails, take a message instead of ending abruptly. ");
  }

  for (const rule of snapshot.decisionRules || []) {
    if (rule.condition && rule.action) {
      lines.push(
        `Decision rule: IF ${rule.condition} THEN ${rule.action}${rule.target ? ` (${rule.target})` : ""}. `,
      );
    }
  }

  const enabledIntents = (snapshot.intentRules || [])
    .filter((i) => (i as { enabled?: boolean }).enabled !== false)
    .map((i) => (i as { label?: string }).label)
    .filter(Boolean);
  if (enabledIntents.length) {
    lines.push(`Recognize caller intents such as: ${enabledIntents.join(", ")}. `);
  }

  return lines;
}

function buildInstructions(snapshot: ReceptionistCompiledSnapshot, businessLabel: string): string {
  const caps = snapshot.capabilities.map((c) => c.replace(/_/g, " ")).join(", ");
  const fields =
    snapshot.fieldManifest.length
      ? `Collect: ${snapshot.fieldManifest.map((f) => f.label).join(", ")}. `
      : "";

  return [
    `You are ${snapshot.agentDisplayName}, the AI receptionist for ${businessLabel}. `,
    snapshot.businessDescription.trim(),
    " ",
    `Your capabilities: ${caps}. `,
    fields,
    ...policyLines(snapshot),
    " ",
    "Speak naturally — your output is synthesized to speech. ",
    "Never speak internal planning aloud. If you promise to check the calendar, book, or transfer — call the matching tool in the same turn. ",
    snapshot.capabilities.includes("answer_questions")
      ? "Use get_business_answer for hours, services, pricing, and FAQs. "
      : "",
    snapshot.capabilities.includes("take_messages")
      ? "Use take_message when they want a callback instead of booking. "
      : "",
    snapshot.capabilities.includes("collect_info")
      ? "Use collect_caller_fields when you need caller details not yet captured. "
      : "",
    snapshot.capabilities.includes("book_appointments")
      ? "For booking: list_available_slots, then schedule_appointment after they confirm a time. "
      : "",
    snapshot.capabilities.includes("transfer_calls")
      ? "Use transfer_to_human only after the caller confirms they want a person. "
      : "",
    snapshot.capabilities.includes("send_text")
      ? "Use send_sms only after the caller agrees to receive a text. "
      : "",
    "When the caller is done, end the call once with a brief farewell.",
  ].join("");
}

export function createGenericReceptionistAgent(input: {
  snapshot: ReceptionistCompiledSnapshot;
  businessName: string;
  timezone: string;
}) {
  const label = input.businessName.trim() || input.snapshot.businessName || "our office";
  const instructions = buildInstructions(input.snapshot, label);

  const agent = voice.Agent.create<FrontDeskUserData>(
    withHybridStreamingAgentOptions({
      instructions,
      tools: llm.toToolContext(
        buildReceptionistTools({
          snapshot: input.snapshot,
          timezone: input.timezone,
        }).toolDefs as never,
      ),
      onEnter: async (agentCtx) => {
        const session = agentCtx.session as AgentSession<FrontDeskUserData>;
        const greeting = input.snapshot.greeting.trim();
        if (greeting) {
          await session.generateReply({
            instructions: `Say exactly this greeting to the caller (warm and natural): ${greeting}`,
            toolChoice: "none",
          });
          return;
        }
        await session.generateReply({
          instructions: `Welcome the caller to ${label}. Ask how you can help today. Keep it brief and warm.`,
          toolChoice: "none",
        });
      },
    }),
  );

  return agent;
}
