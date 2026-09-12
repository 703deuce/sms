import { formatSuppressionReasonLabel } from "@/lib/mctb/analytics-suppression-labels";
import { MCTB_CONSENT_MODE_LABELS, type MctbConsentMode } from "@/lib/mctb/consent-mode";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { formatCompactWhen } from "@/lib/mctb/setup-phone-forwarding-model";

export type TriggerKey = "noAnswer" | "busy" | "rejected" | "timeout" | "voicemail";

export type TriggerState = Record<TriggerKey, boolean>;

export const TRIGGER_OPTIONS: Array<{
  key: TriggerKey;
  label: string;
  helper: string;
}> = [
  { key: "noAnswer", label: "No answer", helper: "Caller rings but no pickup." },
  { key: "busy", label: "Busy", helper: "Line is busy when the call arrives." },
  { key: "rejected", label: "Rejected", helper: "Call is actively declined." },
  { key: "timeout", label: "Unreachable", helper: "Network or routing timeout before answer." },
  {
    key: "voicemail",
    label: "Voicemail",
    helper: "Caller reaches voicemail (when detected on the call path).",
  },
];

export const COOLDOWN_PRESETS_MINUTES = [15, 30, 60, 240] as const;

export function isCooldownOff(minutes: number): boolean {
  return minutes <= 0;
}

/** User-facing cooldown label — never show "0 min". */
export function formatCooldownDisplay(minutes: number): string {
  if (isCooldownOff(minutes)) return "Off";
  return cooldownPresetLabel(minutes);
}

export function formatRepeatCallerSummary(minutes: number): string {
  return isCooldownOff(minutes) ? "Eligible immediately" : "Suppressed during cooldown";
}

export function formatTriggerRailSummary(triggers: TriggerState): string {
  const labels = TRIGGER_OPTIONS.filter((t) => triggers[t.key]).map((t) => t.label);
  if (labels.length === 0) return "None";
  if (labels.length === 2) return `${labels[0]} + ${labels[1]}`;
  return labels.join(", ");
}

export function formatConsentRailValue(mode: MctbConsentMode): { primary: string; secondary: string } {
  if (mode === "press_1") {
    return { primary: "Press 1", secondary: "Per-call consent" };
  }
  return { primary: "Existing", secondary: "Prior permission" };
}

export function cooldownFlowOutcomeLabel(minutes: number): string {
  if (isCooldownOff(minutes)) return "Eligible immediately";
  const end = new Date();
  end.setMinutes(end.getMinutes() + minutes);
  const t = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `Suppressed until ${t}`;
}

export const DIAGNOSTIC_REASONS_LEFT: Array<{ code: string; label: string }> = [
  { code: "TRIGGER_DISABLED", label: "Trigger disabled" },
  { code: "MCTB_DISABLED", label: "Recovery paused" },
  { code: "COOLDOWN_ACTIVE", label: "Cooldown active" },
  { code: "BLOCKED_NUMBER", label: "Caller excluded" },
];

export const DIAGNOSTIC_REASONS_RIGHT: Array<{ code: string; label: string }> = [
  { code: "NOT_EXISTING_CONSENT", label: "Consent unavailable" },
  { code: "MESSAGING_NOT_APPROVED", label: "Sender not approved" },
  { code: "ALREADY_SENT", label: "Duplicate event" },
  { code: "NOT_FORWARD_EVENT", label: "Not a qualifying forwarded call" },
];

export function aggregateSuppressionCounts(
  events: Array<{ suppressionReason: string | null }>,
): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const e of events) {
    const raw = e.suppressionReason?.trim();
    if (!raw) continue;
    const key = raw.toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    if (key.includes("COOLDOWN")) {
      acc.COOLDOWN_ACTIVE = (acc.COOLDOWN_ACTIVE || 0) + 1;
    }
    if (key.includes("MESSAGING") && key.includes("APPROV")) {
      acc.MESSAGING_NOT_APPROVED = (acc.MESSAGING_NOT_APPROVED || 0) + 1;
    }
  }
  return acc;
}

export function isCooldownPresetOrOff(minutes: number): boolean {
  return isCooldownOff(minutes) || isCooldownPreset(minutes);
}

export function countActiveTriggers(triggers: TriggerState): number {
  return Object.values(triggers).filter(Boolean).length;
}

export function formatTriggerSummary(triggers: TriggerState): string {
  const labels = TRIGGER_OPTIONS.filter((t) => triggers[t.key]).map((t) => t.label);
  if (labels.length === 0) return "None selected";
  if (labels.length <= 3) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}

export function cooldownPresetLabel(minutes: number): string {
  if (minutes === 15) return "15 min";
  if (minutes === 30) return "30 min";
  if (minutes === 60) return "1 hr";
  if (minutes === 240) return "4 hr";
  return `${minutes} min`;
}

export function isCooldownPreset(minutes: number): boolean {
  return (COOLDOWN_PRESETS_MINUTES as readonly number[]).includes(minutes);
}

export function formatDelayLabel(delaySeconds: number): string {
  if (delaySeconds <= 0) return "Immediately";
  if (delaySeconds < 60) return `${delaySeconds} sec`;
  const m = Math.round(delaySeconds / 60);
  return `${m} min`;
}

/** @deprecated use formatConsentRailValue */
export function consentSummary(mode: MctbConsentMode): string {
  return formatConsentRailValue(mode).primary;
}

export const SUPPRESSION_EXPLAINERS: Array<{ code: string; label: string; detail: string }> = [
  { code: "MCTB_DISABLED", label: "Recovery paused", detail: "Automatic recovery texts are paused." },
  { code: "FEATURE_DISABLED", label: "Recovery disabled", detail: "Recovery is turned off for this workspace." },
  { code: "TRIGGER_DISABLED", label: "Trigger disabled", detail: "This call outcome is not configured to recover." },
  { code: "COOLDOWN_ACTIVE", label: "Cooldown active", detail: "Same caller was recently sent a recovery text." },
  { code: "NOT_EXISTING_CONSENT", label: "Consent not established", detail: "Caller has not completed consent requirements." },
  { code: "MESSAGING_NOT_APPROVED", label: "Messaging sender not approved", detail: "Text-back sender is not approved to send." },
  { code: "BLOCKED_NUMBER", label: "Caller excluded", detail: "Number is on your exclusion list." },
  { code: "INVALID_PHONE", label: "Invalid destination", detail: "Caller ID is not a valid mobile number." },
  { code: "NOT_FORWARD_EVENT", label: "Not a qualifying forward", detail: "Call did not arrive via configured forwarding." },
  { code: "ALREADY_SENT", label: "Duplicate event", detail: "Recovery was already sent for this call." },
  { code: "OPTED_OUT", label: "Opted out", detail: "Caller is not subscribed to messages." },
  { code: "OUTSIDE_SEND_WINDOW", label: "Outside send window", detail: "Outside configured business hours." },
];

export function formatSuppressionRow(
  callerE164: string,
  reason: string | null,
  detectedAt: string,
): { phone: string; reason: string; time: string } {
  return {
    phone: formatMctbPhoneLabel(callerE164),
    reason: reason ? formatSuppressionReasonLabel(reason) : "Suppressed",
    time: formatCompactWhen(detectedAt) || "",
  };
}

export type RecoverySnapshot = {
  phoneNumberId: string | null;
  triggers: TriggerState;
  cooldownMinutes: number;
  delaySeconds: number;
};

export function recoverySnapshotsEqual(a: RecoverySnapshot, b: RecoverySnapshot): boolean {
  return (
    a.phoneNumberId === b.phoneNumberId &&
    a.cooldownMinutes === b.cooldownMinutes &&
    a.delaySeconds === b.delaySeconds &&
    TRIGGER_OPTIONS.every((t) => a.triggers[t.key] === b.triggers[t.key])
  );
}
