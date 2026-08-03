/**
 * Configurable pre-AI startup greeting (call masking).
 * Plays immediately on answer while media/AI initialize, then hands off to the assistant.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";

export type StartupGreetingMode =
  | "none"
  | "ai"
  | "tts"
  | "audio_url"
  | "transovo_default";

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
  /**
   * Connection greeting preset (UI): Off | Transovo default.
   * Maps onto mode/audioUrl without changing the assistant spoken greeting.
   */
  connectionGreeting?: "off" | "transovo_default";
};

/**
 * Default: AI speaks one complete greeting after media settle.
 * TTS mask is optional — using both caused “Thank you … Thank you” doubles
 * when initiated + answered paths both ran.
 */
export const DEFAULT_STARTUP_GREETING: StartupGreetingConfig = {
  enabled: true,
  mode: "ai",
  text: "Thank you for calling. Please hold for just a moment while I connect you with our AI assistant.",
  audioUrl: "",
  delayMs: "auto",
  handOffWhenReady: true,
};

/** Brief settle after answer before AI greets (no TTS mask). */
export const AI_MEDIA_SETTLE_MS = 700;

export const DEFAULT_AI_GREETING =
  "Thank you for calling. I'm the virtual assistant, and I can answer questions or take a message. How can I help you today?";

export function parseStartupGreeting(
  callHandling: Record<string, unknown> | undefined | null,
): StartupGreetingConfig {
  const raw = (callHandling?.startupGreeting || {}) as Record<string, unknown>;
  const connectionGreetingRaw = String(
    raw.connectionGreeting || callHandling?.connectionGreeting || "",
  );
  const connectionGreeting: "off" | "transovo_default" | undefined =
    connectionGreetingRaw === "transovo_default"
      ? "transovo_default"
      : connectionGreetingRaw === "off"
        ? "off"
        : undefined;

  const modeRaw = String(raw.mode || DEFAULT_STARTUP_GREETING.mode);
  let mode: StartupGreetingMode =
    modeRaw === "none" ||
    modeRaw === "ai" ||
    modeRaw === "tts" ||
    modeRaw === "audio_url" ||
    modeRaw === "transovo_default"
      ? modeRaw
      : "ai";

  // Preset: Transovo default prerecorded connection greeting.
  if (connectionGreeting === "transovo_default" || mode === "transovo_default") {
    mode = "audio_url";
  }
  if (connectionGreeting === "off") {
    mode = "ai";
  }

  let delayMs: "auto" | number = "auto";
  if (typeof raw.delayMs === "number" && Number.isFinite(raw.delayMs)) {
    delayMs = Math.max(0, Math.min(8000, Math.round(raw.delayMs)));
  } else if (raw.delayMs === "auto" || raw.delayMs == null) {
    delayMs = "auto";
  }

  // Legacy: short “Thank you.” TTS mask was the old default and raced with AI greeting.
  // Treat that exact legacy config as AI-only so existing agents stop double-greeting.
  const text = String(raw.text || DEFAULT_STARTUP_GREETING.text).slice(0, 280);
  const legacyShortMask =
    mode === "tts" &&
    /^thank you for calling\.?$/i.test(text.trim()) &&
    raw.enabled !== false;

  let resolvedMode: StartupGreetingMode = legacyShortMask ? "ai" : mode;

  let audioUrl = String(raw.audioUrl || "").trim();
  if (connectionGreeting === "transovo_default" || modeRaw === "transovo_default") {
    const appUrl = (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://transovo.ai"
    ).replace(/\/$/, "");
    audioUrl = `${appUrl}/connection-greeting/transovo-connection-greeting-phone.mp3`;
    resolvedMode = "audio_url";
    // ~4.8s file + small buffer; override if delayMs set explicitly
    if (delayMs === "auto") delayMs = 5000;
  }

  const enabled =
    raw.enabled === undefined
      ? resolvedMode !== "none"
      : Boolean(raw.enabled) && resolvedMode !== "none";

  return {
    enabled,
    mode: resolvedMode,
    text: legacyShortMask ? DEFAULT_STARTUP_GREETING.text : text,
    audioUrl,
    delayMs,
    handOffWhenReady: raw.handOffWhenReady !== false,
    connectionGreeting:
      connectionGreeting ||
      (modeRaw === "transovo_default" ? "transovo_default" : undefined),
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
