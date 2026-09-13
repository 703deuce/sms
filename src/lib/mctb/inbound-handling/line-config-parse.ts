import type { InboundHandlingMode } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readMctbInboundBlock(settingsJson: unknown): Record<string, unknown> {
  const settings = asRecord(settingsJson);
  return asRecord(settings.mctbInbound);
}

export function readInboundHandlingMode(settingsJson: unknown): InboundHandlingMode {
  const inbound = readMctbInboundBlock(settingsJson);
  const raw = String(inbound.inboundHandlingMode || "").trim();
  if (raw === "VOICE_AGENT") return "VOICE_AGENT";
  return "MCTB_RECOVERY";
}
