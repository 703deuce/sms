import { aiBookingStructuredJson } from "@/lib/mctb/ai-booking/agents/json-llm";
import { INTENT_ROUTER_SYSTEM } from "@/lib/mctb/ai-booking/agents/prompts";
import { getAiBookingRouterModel } from "@/lib/mctb/ai-booking/agents/model-config";
import {
  ROUTER_CONFIDENCE_THRESHOLD,
  type IntentRouterResult,
  type IntentRouterIntent,
  type SchedulingSubintent,
} from "@/lib/mctb/ai-booking/agents/types";
import { logMctbAiBookingEvent } from "@/lib/mctb/ai-booking/observability";

function normalizeRouter(raw: Record<string, unknown>): IntentRouterResult | null {
  const intent = String(raw.intent || "UNKNOWN") as IntentRouterIntent;
  const confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) return null;
  const subintent = raw.subintent
    ? (String(raw.subintent) as SchedulingSubintent)
    : null;
  return {
    intent,
    confidence: Math.max(0, Math.min(1, confidence)),
    subintent,
    needs_clarification: raw.needs_clarification === true,
  };
}

/**
 * TEST / LLM-unavailable stub only — not semantic authority in production.
 * Production uses structured LLM router output; fallback is UNKNOWN.
 */
export function deterministicIntentRouter(input: {
  message: string;
  aiBookingSessionActive: boolean;
}): IntentRouterResult {
  const text = input.message.trim().toLowerCase();
  if (input.aiBookingSessionActive && /\d|first|second|third|works|afternoon|morning|yes/i.test(text)) {
    return {
      intent: "SCHEDULING",
      confidence: 0.95,
      subintent: "BOOK_SLOT",
      needs_clarification: false,
    };
  }
  if (/\b(book|schedule|appointment|available|tomorrow|morning|afternoon|friday|tuesday)\b/i.test(text)) {
    return {
      intent: "SCHEDULING",
      confidence: 0.9,
      subintent: "CHECK_AVAILABILITY",
      needs_clarification: false,
    };
  }
  if (/\bbooking link\b/i.test(text)) {
    return {
      intent: "SCHEDULING",
      confidence: 0.85,
      subintent: "ASK_BOOKING_LINK",
      needs_clarification: false,
    };
  }
  if (/\b(human|person|manager|call me back)\b/i.test(text)) {
    return { intent: "HUMAN_HANDOFF", confidence: 0.8, needs_clarification: false };
  }
  if (/\b(price|cost|how much)\b/i.test(text)) {
    return { intent: "GENERAL_CONVERSATION", confidence: 0.85, needs_clarification: false };
  }
  return { intent: "UNKNOWN", confidence: 0.3, needs_clarification: false };
}

export async function runIntentRouterAgent(input: {
  message: string;
  conversation?: Array<{ role: "customer" | "business"; text: string }>;
  /** @deprecated use conversation */
  recentMessages?: Array<{ role: "customer" | "business"; text: string }>;
  aiBookingSessionActive: boolean;
  sessionStage?: string | null;
}): Promise<IntentRouterResult> {
  if (
    input.aiBookingSessionActive &&
    input.sessionStage === "AWAITING_SLOT_SELECTION"
  ) {
    const shortcut: IntentRouterResult = {
      intent: "SCHEDULING",
      confidence: 1,
      subintent: "BOOK_SLOT",
      needs_clarification: false,
    };
    logMctbAiBookingEvent("router_intent", { ...shortcut, shortcut: true });
    return shortcut;
  }

  const conversation =
    input.conversation?.length ? input.conversation : (input.recentMessages || []);
  const userPayload = JSON.stringify({
    latest_message: input.message,
    conversation,
    ai_booking_session_active: input.aiBookingSessionActive,
    session_stage: input.sessionStage || null,
  });

  const parsed = await aiBookingStructuredJson<Record<string, unknown>>({
    system: INTENT_ROUTER_SYSTEM,
    user: userPayload,
    model: getAiBookingRouterModel(),
  });

  const normalized = parsed ? normalizeRouter(parsed) : null;
  const result =
    normalized ||
    ({
      intent: "UNKNOWN" as IntentRouterIntent,
      confidence: 0.2,
      subintent: null,
      needs_clarification: true,
    } satisfies IntentRouterResult);

  logMctbAiBookingEvent("router_intent", {
    intent: result.intent,
    confidence: result.confidence,
    subintent: result.subintent,
  });

  return result;
}

export function shouldRouteToScheduling(result: IntentRouterResult): boolean {
  if (result.intent !== "SCHEDULING") return false;
  if (result.confidence < ROUTER_CONFIDENCE_THRESHOLD) return false;
  return true;
}
