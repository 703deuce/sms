import "server-only";

import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { evaluateMctbAiBookingReadiness } from "@/lib/mctb/ai-booking/readiness";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
export type VoiceBookingMode = "AI_BOOK" | "SEND_BOOKING_LINK" | "COLLECT_ONLY";

export async function resolveVoiceBookingMode(input: {
  workspaceId: string;
  agentId?: string | null;
}): Promise<VoiceBookingMode> {
  const advanced = await loadVoiceAdvanced(input.workspaceId, input.agentId);
  const config = await loadMctbAiBookingConfig(input.workspaceId);
  const readiness = await evaluateMctbAiBookingReadiness(input.workspaceId);
  const workspaceCanAiBook =
    config.enabled && config.entitled && !config.upgradeRequired && readiness.ready;

  const explicit = String(advanced.voiceBookingMode || advanced.bookingMode || "").trim();
  const configuredForAiBook =
    advanced.voiceCanonicalAiBooking === true || explicit === "AI_BOOK";

  if (configuredForAiBook) {
    return "AI_BOOK";
  }

  if (explicit === "SEND_BOOKING_LINK" || explicit === "COLLECT_ONLY") {
    return explicit;
  }
  if (advanced.forceBookingLinkOnly === true) return "SEND_BOOKING_LINK";

  if (workspaceCanAiBook) return "AI_BOOK";
  return "SEND_BOOKING_LINK";
}

/** When agent is configured for live AI booking but readiness is red, surface the blocker — not link mode. */
export async function assertVoiceAiBookingReadyForCall(input: {
  workspaceId: string;
  agentId?: string | null;
}): Promise<
  | { ok: true; mode: "AI_BOOK" }
  | { ok: false; mode: "AI_BOOK"; reason: string; readiness: Awaited<ReturnType<typeof evaluateMctbAiBookingReadiness>> }
> {
  const mode = await resolveVoiceBookingMode(input);
  if (mode !== "AI_BOOK") {
    return {
      ok: false,
      mode: "AI_BOOK",
      reason: "voice_booking_mode_not_ai_book",
      readiness: await evaluateMctbAiBookingReadiness(input.workspaceId),
    };
  }
  const readiness = await evaluateMctbAiBookingReadiness(input.workspaceId);
  if (!readiness.ready) {
    return { ok: false, mode: "AI_BOOK", reason: readiness.reason || "not_ready", readiness };
  }
  return { ok: true, mode: "AI_BOOK" };
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
    const cfg = await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
    return (cfg.advanced || {}) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}
