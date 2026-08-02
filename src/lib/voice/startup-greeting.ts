/**
 * Configurable pre-AI startup greeting (call masking).
 * Plays immediately on answer while media/AI initialize, then hands off to the assistant.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";

export type StartupGreetingMode = "none" | "ai" | "tts" | "audio_url";

export type StartupGreetingConfig = {
  /** Master switch — when false, behave like mode "none". */
  enabled: boolean;
  mode: StartupGreetingMode;
  /** Short TTS / speak text (tts mode). */
  text: string;
  /** Public HTTPS URL for MP3/WAV (audio_url mode). */
  audioUrl: string;
  /**
   * Auto = estimate duration from text/url; number = fixed wait ms before AI handoff.
   */
  delayMs: "auto" | number;
  /** When true, wait for mask to finish (or timeout) before ai_assistant_start. */
  handOffWhenReady: boolean;
};

export const DEFAULT_STARTUP_GREETING: StartupGreetingConfig = {
  enabled: true,
  mode: "tts",
  text: "Thank you for calling.",
  audioUrl: "",
  delayMs: "auto",
  handOffWhenReady: true,
};

export function parseStartupGreeting(
  callHandling: Record<string, unknown> | undefined | null,
): StartupGreetingConfig {
  const raw = (callHandling?.startupGreeting || {}) as Record<string, unknown>;
  const modeRaw = String(raw.mode || DEFAULT_STARTUP_GREETING.mode);
  const mode: StartupGreetingMode =
    modeRaw === "none" ||
    modeRaw === "ai" ||
    modeRaw === "tts" ||
    modeRaw === "audio_url"
      ? modeRaw
      : "tts";

  let delayMs: "auto" | number = "auto";
  if (typeof raw.delayMs === "number" && Number.isFinite(raw.delayMs)) {
    delayMs = Math.max(0, Math.min(8000, Math.round(raw.delayMs)));
  } else if (raw.delayMs === "auto" || raw.delayMs == null) {
    delayMs = "auto";
  }

  const enabled =
    raw.enabled === undefined
      ? mode !== "none"
      : Boolean(raw.enabled) && mode !== "none";

  return {
    enabled,
    mode,
    text: String(raw.text || DEFAULT_STARTUP_GREETING.text).slice(0, 280),
    audioUrl: String(raw.audioUrl || "").trim(),
    delayMs,
    handOffWhenReady: raw.handOffWhenReady !== false,
  };
}

export function startupGreetingFromConfig(config: VoiceAgentConfig): StartupGreetingConfig {
  return parseStartupGreeting(
    (config.callHandling || {}) as Record<string, unknown>,
  );
}

/** Rough speak duration for Call Control TTS before AI handoff. */
export function estimateSpeakMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 800;
  return Math.min(5000, Math.max(700, words * 380 + 400));
}

export function resolveStartupWaitMs(
  cfg: StartupGreetingConfig,
  opts?: { audioDurationMs?: number },
): number {
  if (!cfg.enabled || cfg.mode === "none" || cfg.mode === "ai") return 0;
  if (typeof cfg.delayMs === "number") return cfg.delayMs;
  if (cfg.mode === "audio_url") {
    return opts?.audioDurationMs ?? 2000;
  }
  return estimateSpeakMs(cfg.text);
}

export function shouldPlayPreAiMask(cfg: StartupGreetingConfig): boolean {
  if (!cfg.enabled || !cfg.handOffWhenReady) return false;
  if (cfg.mode === "tts" && cfg.text.trim()) return true;
  if (cfg.mode === "audio_url" && cfg.audioUrl) return true;
  return false;
}
