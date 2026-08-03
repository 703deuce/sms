import type { MessagingRuntimeSettings } from "@/lib/messaging/messaging-settings";

/** Human-first / ring timeout from routing rule actions (wizard writes ringSeconds + timeoutSeconds). */
export function resolveRingTimeoutSeconds(
  actions?: Record<string, unknown> | null,
  fallback = 30,
): number {
  const n = Number(
    actions?.timeoutSeconds || actions?.ringTimeout || actions?.ringSeconds || fallback,
  );
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(5, Math.min(300, Math.round(n)));
}

/** Prefer wizard/rule timezone on actions over workspace messaging timezone. */
export function applyActionTimezone(
  settings: MessagingRuntimeSettings,
  actions?: Record<string, unknown> | null,
): MessagingRuntimeSettings {
  const fromConditions = (actions?.conditions as Record<string, unknown> | undefined)?.timezone;
  const timezone = String(actions?.timezone || fromConditions || "").trim();
  if (!timezone) return settings;
  return { ...settings, timezone };
}

/** Transfer success vs dial-started: dial sets transferred=true before bridge completes. */
export function resolveTransferInsightFields(input: {
  text: string;
  transferred: boolean;
  outcome?: string | null;
}): { transfer_attempted: boolean; transfer_successful: boolean } {
  const text = input.text || "";
  return {
    transfer_attempted: Boolean(input.transferred) || /transfer/i.test(text),
    transfer_successful:
      input.outcome === "transferred" ||
      /transfer (completed|successful|connected|bridged)/i.test(text),
  };
}
