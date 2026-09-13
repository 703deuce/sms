import { getOpenAiModel, getOpenAiApiKey } from "@/lib/ai/openai";
import { DEFAULT_OPENAI_MODEL } from "@/lib/ai/llm-providers";

/** Mini-class models for narrow AI Booking agents — reuses central OpenAI config. */
export function getAiBookingRouterModel(): string {
  return (
    process.env.AI_BOOKING_ROUTER_MODEL?.trim() ||
    process.env.AI_BOOKING_MINI_MODEL?.trim() ||
    getOpenAiModel() ||
    DEFAULT_OPENAI_MODEL
  );
}

export function getAiBookingSchedulerModel(): string {
  return (
    process.env.AI_BOOKING_SCHEDULER_MODEL?.trim() ||
    process.env.AI_BOOKING_MINI_MODEL?.trim() ||
    getOpenAiModel() ||
    DEFAULT_OPENAI_MODEL
  );
}

export function getAiBookingPhrasingModel(): string {
  return (
    process.env.AI_BOOKING_PHRASING_MODEL?.trim() ||
    getAiBookingSchedulerModel()
  );
}

export function hasAiBookingLlmConfigured(): boolean {
  return Boolean(getOpenAiApiKey());
}
