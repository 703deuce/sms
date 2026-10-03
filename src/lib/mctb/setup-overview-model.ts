import { MCTB_CONSENT_MODE_LABELS, type MctbConsentMode } from "@/lib/mctb/consent-mode";
import { describeMctbSenderPresentation } from "@/lib/mctb/sender-presentation";
import { getCarrierGuide } from "@/lib/mctb/onboarding/carriers";
import type { MctbForwardingCarrier } from "@/lib/mctb/onboarding/types";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { MctbPauseKind } from "@/lib/mctb/schedule-shared";

export type SetupOverviewRowStatus = "ok" | "warning" | "neutral" | "error";

export type SetupOverviewRowGroup = "call-flow" | "operations";

export type SetupOverviewSummaryRow = {
  id: string;
  title: string;
  /** @deprecated use secondary — kept for tests */
  summary: string;
  secondary: string;
  operationalDetail: string;
  statusLabel: string;
  status: SetupOverviewRowStatus;
  href: string;
  group: SetupOverviewRowGroup;
};

export type SetupFlowStage = {
  id: string;
  label: string;
  stateLabel: string;
  tone: "ok" | "warning" | "neutral" | "muted";
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
  runtime: RuntimeSlice & { senderMode?: "PLATFORM" | "WORKSPACE" };
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
  const senderMode = runtime.senderMode || "WORKSPACE";

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
    senderLabel:
      senderMode === "PLATFORM"
        ? "Platform sender · Active"
        : smsPhone
          ? `${formatMctbPhoneLabel(smsPhone.e164)} · ${messagingReady ? "Ready" : "Pending"}`
          : "Your verified number",
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

export function buildSetupFlowStages(input: {
  consentMode: MctbConsentMode;
  forwardingVerified: boolean;
  recoveryPaused: boolean;
  recoveryActive: boolean;
  voicemailReady: boolean;
}): SetupFlowStage[] {
  const consentState =
    input.consentMode === "press_1" ? "Press 1" : "Existing permission";
  const recoveryState = input.recoveryPaused
    ? "Paused"
    : input.recoveryActive
      ? "Active"
      : "Off";
  const recoveryTone = input.recoveryPaused ? "warning" : input.recoveryActive ? "ok" : "neutral";

  return [
    { id: "missed", label: "Missed call", stateLabel: "Listening", tone: "neutral" },
    {
      id: "forward",
      label: "Forwarded",
      stateLabel: input.forwardingVerified ? "Verified" : "Pending",
      tone: input.forwardingVerified ? "ok" : "warning",
    },
    { id: "consent", label: "Consent", stateLabel: consentState, tone: "neutral" },
    { id: "text", label: "Text sent", stateLabel: recoveryState, tone: recoveryTone },
    {
      id: "vm",
      label: "Voicemail",
      stateLabel: input.voicemailReady ? "Ready" : "Setup",
      tone: input.voicemailReady ? "ok" : "warning",
    },
  ];
}

/** Five canonical readiness checks derived from live setup state (no fabricated counts). */
export function buildCoreSystemsReadiness(input: {
  forwardingVerified: boolean;
  messagingReady: boolean;
  recoveryPaused: boolean;
  triggersOn: boolean;
  messageConfigured: boolean;
  voicemailReady: boolean;
}): { ready: number; total: number } {
  const checks = [
    input.forwardingVerified,
    input.messagingReady,
    !input.recoveryPaused && input.triggersOn,
    input.messageConfigured,
    input.voicemailReady,
  ];
  return { ready: checks.filter(Boolean).length, total: checks.length };
}

export function resolveSetupChipTone(
  statusLabel: string,
  status: SetupOverviewRowStatus,
): "positive" | "neutral" | "attention" | "danger" {
  const label = statusLabel.toLowerCase();
  if (status === "error") return "danger";
  if (["verified", "active", "ready", "passed"].some((k) => label.includes(k))) return "positive";
  if (
    ["pending", "needs", "missing", "not run", "unavailable", "not configured"].some((k) =>
      label.includes(k),
    )
  ) {
    return "attention";
  }
  return "neutral";
}

export function buildSetupSummaryRows(input: {
  runtime: RuntimeSlice;
  schedule: ScheduleSlice;
  consentMode: MctbConsentMode;
  businessLineE164?: string | null;
  forwardTargetE164?: string | null;
  forwardingVerified: boolean;
  forwardingCarrier?: MctbForwardingCarrier | null;
  forwardingRingSeconds?: number | null;
  messagingReady: boolean;
  exclusionCount: number;
  lastTestAt: string | null;
  liveTestPassed: boolean;
  notificationSummary: string;
  voicemailSummary: string;
  voicemailTranscriptionOn?: boolean;
  existingConsentBlocked: boolean;
  linksSummary?: string;
  senderMode?: "PLATFORM" | "WORKSPACE" | null;
}): SetupOverviewSummaryRow[] {
  const r = input.runtime;
  const triggersOn =
    r.sendAfterNoAnswer || r.sendAfterBusy || r.sendAfterRejected || r.sendAfterTimeout;
  const paused = input.schedule.paused || !r.enabled;
  const msgLen = r.messageTemplate.trim().length;

  const line = input.businessLineE164 ? formatMctbPhoneLabel(input.businessLineE164) : null;
  const fwd = input.forwardTargetE164 ? formatMctbPhoneLabel(input.forwardTargetE164) : null;
  const phoneSecondary =
    line && fwd ? `${line} → ${fwd}` : line ? line : "Business line not configured";
  const phoneSummary = phoneSecondary;
  const carrierLabel = input.forwardingCarrier
    ? getCarrierGuide(input.forwardingCarrier).label
    : null;
  const ring =
    input.forwardingRingSeconds != null ? `${input.forwardingRingSeconds} sec ring` : null;
  const phoneOperational = [carrierLabel, ring].filter(Boolean).join(" · ") || "Carrier & ring timing";
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
  if (r.sendAfterRejected) triggerBits.push("Rejected");
  if (r.sendAfterTimeout) triggerBits.push("Unreachable");
  const recoverySecondary = paused
    ? "Recovery paused"
    : triggersOn
      ? triggerBits.join(" + ")
      : "No triggers enabled";
  const recoverySummary = recoverySecondary;
  const recoveryOperational = `Cooldown: ${formatCooldown(r.cooldownMinutes)}`;

  const consent = MCTB_CONSENT_MODE_LABELS[input.consentMode];
  const consentSecondary =
    input.consentMode === "press_1" ? "Press-1 consent" : "Use existing permission";
  const consentOperational =
    input.consentMode === "press_1"
      ? "Caller presses 1 before recovery text"
      : "Business attestation on file";
  const consentSummary = consentSecondary;

  const senderCopy = describeMctbSenderPresentation(input.senderMode);
  const msgPreview = r.messageTemplate.trim().replace(/\s+/g, " ").slice(0, 48);
  const textSecondary =
    input.senderMode === "PLATFORM"
      ? senderCopy.title
      : msgLen > 0
        ? `Configured · ${msgLen} characters`
        : "Not configured";
  const textOperational =
    input.senderMode === "PLATFORM"
      ? "Transovo-controlled recovery opener"
      : msgLen > 0
        ? `"${msgPreview}${r.messageTemplate.trim().length > 48 ? "…" : ""}"`
        : "Add your recovery opener";

  const vmSecondary = input.voicemailSummary.replace(" · Active", "");
  const vmOperational =
    input.voicemailTranscriptionOn === true
      ? "Transcription on"
      : input.voicemailTranscriptionOn === false
        ? "Transcription off"
        : "Greeting & fallback";

  const notifParts = input.notificationSummary.split(" · ");
  const notifSecondary = notifParts[0] || input.notificationSummary;

  const exclSecondary =
    input.exclusionCount > 0 ? `${input.exclusionCount} blocked callers` : "No blocked callers";

  const testSecondary = input.lastTestAt
    ? `Last successful test ${formatShortWhenCompact(input.lastTestAt)}`
    : input.liveTestPassed
      ? "Live test passed"
      : "Never tested";
  const testOperational = "Production path";

  const linksSecondary = input.linksSummary || "Request form and shared links";

  return [
    {
      id: "phone",
      title: "Phone & Forwarding",
      summary: phoneSummary,
      secondary: phoneSecondary,
      operationalDetail: phoneOperational,
      statusLabel: phoneStatusLabel,
      status: phoneStatus,
      href: MCTB_ROUTES.setupPhone,
      group: "call-flow",
    },
    {
      id: "consent",
      title: "Consent",
      summary: consentSummary,
      secondary: consentSecondary,
      operationalDetail: consentOperational,
      statusLabel: input.existingConsentBlocked ? "Unavailable" : consent?.title ? "Configured" : "Not set",
      status: input.existingConsentBlocked ? "error" : "neutral",
      href: MCTB_ROUTES.setupConsent,
      group: "call-flow",
    },
    {
      id: "text-back",
      title: "Text Back",
      summary: textSecondary,
      secondary: textSecondary,
      operationalDetail: textOperational,
      statusLabel:
        input.senderMode === "PLATFORM"
          ? "Managed"
          : msgLen > 0
            ? "Configured"
            : "Missing",
      status: input.senderMode === "PLATFORM" || msgLen > 0 ? "ok" : "warning",
      href: MCTB_ROUTES.setupTextBack,
      group: "call-flow",
    },
    {
      id: "recovery",
      title: "Recovery",
      summary: recoverySummary,
      secondary: recoverySecondary,
      operationalDetail: recoveryOperational,
      statusLabel: paused ? "Paused" : triggersOn ? "Active" : "Needs attention",
      status: paused ? "warning" : triggersOn ? "ok" : "warning",
      href: MCTB_ROUTES.setupRecovery,
      group: "call-flow",
    },
    {
      id: "voicemail",
      title: "Voicemail",
      summary: vmSecondary,
      secondary: vmSecondary,
      operationalDetail: vmOperational,
      statusLabel: input.voicemailSummary.includes("Not") ? "Not configured" : "Ready",
      status: input.voicemailSummary.includes("Not") ? "warning" : "ok",
      href: MCTB_ROUTES.setupVoicemail,
      group: "call-flow",
    },
    {
      id: "notifications",
      title: "Notifications",
      summary: input.notificationSummary,
      secondary: notifSecondary,
      operationalDetail: notifParts[1] || "Team alerts",
      statusLabel: input.notificationSummary.includes("No recipients") ? "Off" : "Configured",
      status: "neutral",
      href: MCTB_ROUTES.setupNotifications,
      group: "operations",
    },
    {
      id: "exclusions",
      title: "Exclusions",
      summary: exclSecondary,
      secondary: exclSecondary,
      operationalDetail: "Do-not-text list",
      statusLabel: input.exclusionCount > 0 ? "Active" : "None",
      status: "neutral",
      href: MCTB_ROUTES.setupExclusions,
      group: "operations",
    },
    {
      id: "links",
      title: "Links",
      summary: linksSecondary,
      secondary: linksSecondary,
      operationalDetail: "Request form · customer URLs",
      statusLabel: input.linksSummary?.includes("Enabled") ? "Active" : "Optional",
      status: "neutral",
      href: MCTB_ROUTES.setupLinks,
      group: "operations",
    },
    {
      id: "test",
      title: "Test",
      summary: testSecondary,
      secondary: testSecondary,
      operationalDetail: testOperational,
      statusLabel: input.liveTestPassed ? "Passed" : "Needs test",
      status: input.liveTestPassed ? "ok" : "neutral",
      href: MCTB_ROUTES.setupTest,
      group: "operations",
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

export type SetupActivityKind = "success" | "start" | "provision" | "neutral";

const FUNNEL_KIND: Record<string, SetupActivityKind> = {
  MCTB_FORWARDING_VERIFIED: "success",
  MCTB_LIVE_TEST_PASSED: "success",
  MCTB_LIVE_TEST_STARTED: "start",
  MCTB_TRIAL_NUMBER_PROVISIONED: "provision",
  MCTB_TFV_APPROVED: "success",
};

export function buildSetupActivityFromFunnel(
  funnelEvents: Record<string, string> | undefined,
  limit = 5,
): Array<{ label: string; at: string; kind: SetupActivityKind }> {
  if (!funnelEvents) return [];
  return Object.entries(funnelEvents)
    .filter(([key]) => FUNNEL_LABELS[key])
    .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
    .slice(0, limit)
    .map(([key, at]) => ({
      label: FUNNEL_LABELS[key] || key,
      at,
      kind: FUNNEL_KIND[key] || "neutral",
    }));
}

export function formatShortWhenCompact(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
