import { MCTB_CONSENT_MODE_LABELS, type MctbConsentMode } from "@/lib/mctb/consent-mode";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { MctbPauseKind } from "@/lib/mctb/schedule-shared";

export type SetupOverviewRowStatus = "ok" | "warning" | "neutral" | "error";

export type SetupOverviewSummaryRow = {
  id: string;
  title: string;
  summary: string;
  statusLabel: string;
  status: SetupOverviewRowStatus;
  href: string;
};

export type SetupAttentionItem = {
  id: string;
  message: string;
  actionLabel: string;
  href: string;
};

export type SetupGlobalStatus = {
  recoveryLabel: string;
  businessLineLabel: string | null;
  senderLabel: string | null;
  forwardingLabel: string;
  lastTestLabel: string;
  pauseKind: MctbPauseKind;
  paused: boolean;
  pauseUntil: string | null;
  messagingReady: boolean;
};

type RuntimeSlice = {
  enabled: boolean;
  phoneNumberId: string | null;
  smsPhoneNumberId?: string | null;
  messageTemplate: string;
  sendAfterNoAnswer: boolean;
  sendAfterBusy: boolean;
  sendAfterRejected: boolean;
  sendAfterTimeout: boolean;
  cooldownMinutes: number;
  replyNotifications?: boolean;
};

type ScheduleSlice = {
  paused: boolean;
  pauseUntil?: string | null;
  pauseKind?: MctbPauseKind;
};

export function buildSetupGlobalStatus(input: {
  runtime: RuntimeSlice;
  schedule: ScheduleSlice;
  businessLineE164?: string | null;
  phoneNumbers: Array<{ id: string; e164: string; label?: string | null }>;
  forwardingVerified: boolean;
  messagingReady: boolean;
  lastTestAt: string | null;
}): SetupGlobalStatus {
  const { runtime, schedule, businessLineE164, phoneNumbers, forwardingVerified, messagingReady, lastTestAt } =
    input;
  const smsId = runtime.smsPhoneNumberId || runtime.phoneNumberId;
  const smsPhone = phoneNumbers.find((p) => p.id === smsId);

  let recoveryLabel = "Recovery active";
  if (schedule.paused || !runtime.enabled) {
    if (schedule.pauseKind === "timed" && schedule.pauseUntil) {
      recoveryLabel = `Paused until ${formatShortWhen(schedule.pauseUntil)}`;
    } else if (schedule.pauseKind === "manual" || !runtime.enabled) {
      recoveryLabel = "Paused until manually resumed";
    } else {
      recoveryLabel = "Recovery paused";
    }
  } else if (!messagingReady) {
    recoveryLabel = "Messaging verification pending";
  }

  return {
    recoveryLabel,
    businessLineLabel: businessLineE164 ? formatMctbPhoneLabel(businessLineE164) : null,
    senderLabel: smsPhone ? `${formatMctbPhoneLabel(smsPhone.e164)} · ${messagingReady ? "Ready" : "Pending"}` : null,
    forwardingLabel: forwardingVerified ? "Forwarding verified" : "Forwarding not verified",
    lastTestLabel: lastTestAt ? `Last tested ${formatShortWhen(lastTestAt)}` : "Never tested",
    pauseKind: schedule.pauseKind ?? (schedule.paused ? "manual" : null),
    paused: schedule.paused,
    pauseUntil: schedule.pauseUntil ?? null,
    messagingReady,
  };
}

export function buildSetupAttentionItems(input: {
  forwardingVerified: boolean;
  messagingReady: boolean;
  requiredActions: string[];
  triggersOn: boolean;
  consentMode: MctbConsentMode;
  existingConsentBlocked: boolean;
  voicemailConfigured: boolean;
}): SetupAttentionItem[] {
  const items: SetupAttentionItem[] = [];
  if (!input.forwardingVerified) {
    items.push({
      id: "forwarding",
      message: "Forwarding has not been verified.",
      actionLabel: "Test forwarding",
      href: MCTB_ROUTES.setupPhone,
    });
  }
  if (!input.messagingReady) {
    items.push({
      id: "messaging",
      message: input.requiredActions[0] || "Messaging sender verification is pending.",
      actionLabel: "View sender status",
      href: MCTB_ROUTES.setupPhone,
    });
  }
  if (!input.triggersOn) {
    items.push({
      id: "triggers",
      message: "No missed-call triggers are enabled.",
      actionLabel: "Open recovery",
      href: MCTB_ROUTES.setupRecovery,
    });
  }
  if (input.existingConsentBlocked && input.consentMode === "existing_consent") {
    items.push({
      id: "consent-sender",
      message: "Existing-consent mode requires an eligible business-owned sender.",
      actionLabel: "Review consent",
      href: MCTB_ROUTES.setupConsent,
    });
  }
  if (!input.voicemailConfigured) {
    items.push({
      id: "voicemail",
      message: "Voicemail greeting is not configured.",
      actionLabel: "Set up voicemail",
      href: MCTB_ROUTES.setupVoicemail,
    });
  }
  return items;
}

export function buildSetupSummaryRows(input: {
  runtime: RuntimeSlice;
  schedule: ScheduleSlice;
  consentMode: MctbConsentMode;
  businessLineE164?: string | null;
  forwardTargetE164?: string | null;
  forwardingVerified: boolean;
  messagingReady: boolean;
  exclusionCount: number;
  lastTestAt: string | null;
  liveTestPassed: boolean;
  notificationSummary: string;
  voicemailSummary: string;
  existingConsentBlocked: boolean;
}): SetupOverviewSummaryRow[] {
  const r = input.runtime;
  const triggersOn =
    r.sendAfterNoAnswer || r.sendAfterBusy || r.sendAfterRejected || r.sendAfterTimeout;
  const paused = input.schedule.paused || !r.enabled;
  const msgLen = r.messageTemplate.trim().length;

  const line = input.businessLineE164 ? formatMctbPhoneLabel(input.businessLineE164) : null;
  const fwd = input.forwardTargetE164 ? formatMctbPhoneLabel(input.forwardTargetE164) : null;
  const phoneSummary =
    line && fwd ? `${line} → ${fwd}` : line ? line : "Business line not configured";
  const phoneStatus: SetupOverviewRowStatus =
    line && input.forwardingVerified && r.phoneNumberId ? "ok" : line ? "warning" : "neutral";
  const phoneStatusLabel = !line
    ? "Not configured"
    : input.forwardingVerified
      ? "Verified"
      : "Pending";

  const triggerBits: string[] = [];
  if (r.sendAfterNoAnswer) triggerBits.push("No answer");
  if (r.sendAfterBusy) triggerBits.push("Busy");
  if (r.sendAfterRejected) triggerBits.push("Unreachable");
  if (r.sendAfterTimeout) triggerBits.push("Timeout");
  const recoverySummary = paused
    ? "Paused"
    : triggersOn
      ? `Active · ${triggerBits.join(" + ")} · ${formatCooldown(r.cooldownMinutes)} repeat cooldown`
      : "No triggers enabled";

  const consent = MCTB_CONSENT_MODE_LABELS[input.consentMode];
  const consentSummary =
    input.consentMode === "press_1"
      ? "Press 1 · Per-call consent capture"
      : "Existing consent · Business attestation";

  return [
    {
      id: "phone",
      title: "Phone & Forwarding",
      summary: phoneSummary,
      statusLabel: phoneStatusLabel,
      status: phoneStatus,
      href: MCTB_ROUTES.setupPhone,
    },
    {
      id: "recovery",
      title: "Recovery",
      summary: recoverySummary,
      statusLabel: paused ? "Paused" : triggersOn ? "Active" : "Needs attention",
      status: paused ? "warning" : triggersOn ? "ok" : "warning",
      href: MCTB_ROUTES.setupRecovery,
    },
    {
      id: "consent",
      title: "Consent",
      summary: consentSummary,
      statusLabel: input.existingConsentBlocked ? "Unavailable" : consent?.title ? "Configured" : "Not set",
      status: input.existingConsentBlocked ? "error" : "ok",
      href: MCTB_ROUTES.setupConsent,
    },
    {
      id: "text-back",
      title: "Text-back message",
      summary: msgLen > 0 ? `Configured · ${msgLen} characters` : "Not configured",
      statusLabel: msgLen > 0 ? "Configured" : "Missing",
      status: msgLen > 0 ? "ok" : "warning",
      href: `${MCTB_ROUTES.setupTextBack}`,
    },
    {
      id: "voicemail",
      title: "Voicemail",
      summary: input.voicemailSummary,
      statusLabel: input.voicemailSummary.includes("Not") ? "Not configured" : "Ready",
      status: input.voicemailSummary.includes("Not") ? "warning" : "ok",
      href: MCTB_ROUTES.setupVoicemail,
    },
    {
      id: "notifications",
      title: "Notifications",
      summary: input.notificationSummary,
      statusLabel: "Current",
      status: "neutral",
      href: MCTB_ROUTES.setupNotifications,
    },
    {
      id: "exclusions",
      title: "Exclusions",
      summary: input.exclusionCount > 0 ? `${input.exclusionCount} blocked numbers` : "None",
      statusLabel: input.exclusionCount > 0 ? "Active" : "None",
      status: "neutral",
      href: MCTB_ROUTES.setupExclusions,
    },
    {
      id: "test",
      title: "Test & diagnostics",
      summary: input.lastTestAt
        ? `Last successful test: ${formatShortWhen(input.lastTestAt)}`
        : input.liveTestPassed
          ? "Live test passed"
          : "Never tested",
      statusLabel: input.liveTestPassed ? "Passed" : "Not run",
      status: input.liveTestPassed ? "ok" : "neutral",
      href: MCTB_ROUTES.setupTest,
    },
  ];
}

const FUNNEL_LABELS: Record<string, string> = {
  MCTB_FORWARDING_VERIFIED: "Forwarding verified",
  MCTB_LIVE_TEST_PASSED: "Live test passed",
  MCTB_LIVE_TEST_STARTED: "Live test started",
  MCTB_TRIAL_NUMBER_PROVISIONED: "Sender number provisioned",
  MCTB_TFV_APPROVED: "Messaging sender ready",
};

export function buildSetupActivityFromFunnel(
  funnelEvents: Record<string, string> | undefined,
  limit = 5,
): Array<{ label: string; at: string }> {
  if (!funnelEvents) return [];
  return Object.entries(funnelEvents)
    .filter(([key]) => FUNNEL_LABELS[key])
    .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
    .slice(0, limit)
    .map(([key, at]) => ({ label: FUNNEL_LABELS[key] || key, at }));
}

function formatShortWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatCooldown(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}
