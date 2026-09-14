import "server-only";

import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { evaluateMctbAiBookingReadiness } from "@/lib/mctb/ai-booking/readiness";
import { loadVoiceAgentRuntimeConfigRecord } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

export type VoiceBookingMode = "AI_BOOK" | "SEND_BOOKING_LINK" | "COLLECT_ONLY";

export async function resolveVoiceBookingMode(input: {
  workspaceId: string;
  agentId?: string | null;
}): Promise<VoiceBookingMode> {
  const advanced = await loadVoiceAdvanced(input.workspaceId, input.agentId);
  const config = await loadMctbAiBookingConfig(input.workspaceId);
  const workspaceCanAiBook =
    config.enabled &&
    config.entitled &&
    !config.upgradeRequired &&
    (await evaluateMctbAiBookingReadiness(input.workspaceId)).ready;

  if (advanced.voiceCanonicalAiBooking === true && workspaceCanAiBook) {
    return "AI_BOOK";
  }

  const explicit = String(advanced.voiceBookingMode || advanced.bookingMode || "").trim();
  if (explicit === "AI_BOOK") return "AI_BOOK";
  if (explicit === "SEND_BOOKING_LINK" || explicit === "COLLECT_ONLY") {
    return explicit;
  }
  if (advanced.forceBookingLinkOnly === true) return "SEND_BOOKING_LINK";

  if (workspaceCanAiBook) return "AI_BOOK";
  return "SEND_BOOKING_LINK";
}

export async function isVoiceCanonicalAiBookingActive(input: {
  workspaceId: string;
  agentId?: string | null;
}): Promise<boolean> {
  const mode = await resolveVoiceBookingMode(input);
  return mode === "AI_BOOK";
}

async function loadVoiceAdvanced(workspaceId: string, agentId?: string | null) {
  if (!agentId) return {} as Record<string, unknown>;
  try {
    const rec = await loadVoiceAgentRuntimeConfigRecord(workspaceId, agentId);
    const cfg = parseVoiceAgentConfig(rec.config);
    return (cfg.advanced || {}) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}
