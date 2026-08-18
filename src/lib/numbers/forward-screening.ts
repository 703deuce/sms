/**
 * Press-1 screening and unanswered forwarding behavior for Personal numbers.
 */

import type { PersonalCallSettings } from "./personal-call-settings";
import {
  normalizeForwardUnansweredAction,
} from "./personal-call-settings";

export const FORWARD_RING_MIN_SECONDS = 15;
export const FORWARD_RING_MAX_SECONDS = 45;
export const DEFAULT_FORWARD_RING_SECONDS = 20;
export const DEFAULT_SCREENING_SECONDS = 8;
export const SCREENING_MIN_SECONDS = 5;
export const SCREENING_MAX_SECONDS = 8;

export const TRANSOVO_SCREEN_PROMPT =
  "Incoming call to your Transovo number. Press 1 to accept.";

export function clampForwardRingSeconds(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_FORWARD_RING_SECONDS;
  return Math.min(FORWARD_RING_MAX_SECONDS, Math.max(FORWARD_RING_MIN_SECONDS, Math.round(raw)));
}

export function clampScreeningSeconds(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_SCREENING_SECONDS;
  return Math.min(SCREENING_MAX_SECONDS, Math.max(SCREENING_MIN_SECONDS, Math.round(raw)));
}

/** Optional Press-1 — only when customer explicitly enables Call Screening. */
export function requiresPress1Screening(settings: PersonalCallSettings): boolean {
  return settings.callScreeningEnabled === true;
}

export function effectiveForwardRingSeconds(settings: PersonalCallSettings): number {
  const action = normalizeForwardUnansweredAction(
    settings.forwardUnansweredAction,
    settings.voicemailEnabled,
  );
  if (action === "destination_voicemail") {
    return FORWARD_RING_MAX_SECONDS;
  }
  return clampForwardRingSeconds(settings.forwardRingSeconds);
}

export function defaultUnansweredAction(voicemailEnabled: boolean): import("./personal-call-settings").ForwardUnansweredAction {
  return voicemailEnabled ? "transovo_voicemail" : "destination_voicemail";
}

export function isScreeningAccepted(notes: string | null | undefined): boolean {
  return (notes || "").includes("screening:accepted");
}
