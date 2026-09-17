import { OPENAI_REALTIME_BRIDGE_VOICE } from "../openai-realtime-bridge/flags";

export const OPENAI_LIVE_MODEL_ID =
  process.env.OPENAI_LIVE_MODEL?.trim() || "gpt-live-1";

export const OPENAI_LIVE_VOICE =
  process.env.OPENAI_LIVE_VOICE?.trim() || OPENAI_REALTIME_BRIDGE_VOICE;

export const OPENAI_LIVE_BACKEND_MODEL =
  process.env.OPENAI_LIVE_BACKEND_MODEL?.trim() || "gpt-5-mini";

/** Use split Live frontend + Responses backend instruction files (default on). */
export function isOpenAiLiveSplitPromptsEnabled(): boolean {
  return process.env.OPENAI_LIVE_SPLIT_PROMPTS !== "0";
}

/** Attach Responses delegation + tools to session.start (opt-in until tool loop is certified). */
export function isOpenAiLiveDelegationEnabled(): boolean {
  return process.env.OPENAI_LIVE_DELEGATION === "1";
}
