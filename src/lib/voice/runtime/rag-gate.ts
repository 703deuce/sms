/**
 * Runtime gate: block RAG retrieval for compact prompt-context topics.
 * Prompt knows the business. RAG knows the library.
 */
import {
  isCompanyNameTopic,
  isHoursTopic,
  isPricingTopic,
  isServiceAreaTopic,
  isServicesTopic,
} from "@/lib/voice/knowledge/business-answer-topics";
import { isRuntimeAuthoritativeTopic } from "@/lib/voice/prompt/knowledge-classification";

export type RagGateDecision =
  | { route: "prompt_context"; reason: string }
  | { route: "runtime_authoritative"; reason: string }
  | { route: "rag_allowed"; reason: string };

const LIVE_AVAILABILITY_PATTERNS = [
  /\b(tuesday|monday|wednesday|thursday|friday|saturday|sunday)\b.*\b(at|@)\b/i,
  /\bdo you have\b.*\b(open|available|slot|appointment)\b/i,
  /\bavailable\b.*\b(tomorrow|today|next week)\b/i,
  /\bwhat time(s)?\b.*\bavailable\b/i,
];

const PAYMENT_STATUS_PATTERNS = [
  /\bdid my payment\b/i,
  /\bpayment go through\b/i,
  /\bcharge(d)?\b.*\bcard\b/i,
  /\bbalance\b/i,
];

const ON_CALL_PATTERNS = [/\bon call\b/i, /\bwho is\b.*\b(on call|working tonight)\b/i];

export function evaluateRagGate(query: string): RagGateDecision {
  const q = query.trim();
  const lower = q.toLowerCase();

  if (!q) {
    return { route: "prompt_context", reason: "empty_query" };
  }

  if (isRuntimeAuthoritativeTopic(lower)) {
    return { route: "runtime_authoritative", reason: "explicit_runtime_topic" };
  }

  if (LIVE_AVAILABILITY_PATTERNS.some((re) => re.test(q))) {
    return { route: "runtime_authoritative", reason: "live_availability" };
  }
  if (PAYMENT_STATUS_PATTERNS.some((re) => re.test(q))) {
    return { route: "runtime_authoritative", reason: "payment_status" };
  }
  if (ON_CALL_PATTERNS.some((re) => re.test(q))) {
    return { route: "runtime_authoritative", reason: "on_call_staff" };
  }

  if (isHoursTopic(lower)) {
    return { route: "prompt_context", reason: "business_hours_in_prompt" };
  }
  if (isCompanyNameTopic(lower) || /\baddress\b|\blocated\b|\blocation\b|\bwhere are you\b/i.test(lower)) {
    return { route: "prompt_context", reason: "business_location_in_prompt" };
  }
  if (isPricingTopic(lower)) {
    return { route: "prompt_context", reason: "approved_pricing_in_prompt" };
  }
  if (isServiceAreaTopic(lower)) {
    return { route: "prompt_context", reason: "service_area_in_prompt" };
  }
  if (isServicesTopic(lower)) {
    return { route: "prompt_context", reason: "services_in_prompt" };
  }

  return { route: "rag_allowed", reason: "long_tail_or_specific_detail" };
}
