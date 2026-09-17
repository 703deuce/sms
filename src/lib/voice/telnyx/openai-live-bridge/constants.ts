import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OPENAI_REALTIME_BRIDGE_VOICE } from "../openai-realtime-bridge/flags";

function readOpenAiLiveDelegationFile(): string | null {
  const candidates = [
    "/app/.openai_live_delegation",
    process.env.OPENAI_LIVE_DELEGATION_FILE?.trim(),
    join(process.cwd(), ".openai_live_delegation"),
  ].filter(Boolean) as string[];
  for (const path of candidates) {
    try {
      if (!existsSync(path)) continue;
      const value = readFileSync(path, "utf8").trim().toLowerCase();
      if (value) return value;
    } catch {
      /* try next */
    }
  }
  return null;
}

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

/**
 * Responses delegation + booking tools on session.start.
 * Opt out: OPENAI_LIVE_DELEGATION=0 or `echo 0 > /app/.openai_live_delegation`
 * With split prompts (default), delegation defaults ON so booking can reach Voice V2 tools.
 */
export function isOpenAiLiveDelegationEnabled(): boolean {
  const env = process.env.OPENAI_LIVE_DELEGATION?.trim().toLowerCase();
  if (env === "0" || env === "false") return false;
  if (env === "1" || env === "true") return true;
  const file = readOpenAiLiveDelegationFile();
  if (file === "0" || file === "false") return false;
  if (file === "1" || file === "true") return true;
  return isOpenAiLiveSplitPromptsEnabled();
}
