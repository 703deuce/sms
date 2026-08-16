import type { PhoneNumber } from "@prisma/client";

export type VaultIncomingMode = "silent" | "parked_message" | "voicemail";
export type IncomingCallHandling = "forward" | "voicemail_only" | "announcement_only";
export type ForwardMode = "single" | "sequential" | "simultaneous";
export type ForwardFallbackAction = "voicemail" | "another_number" | "announcement" | "end";
export type ForwardUnansweredAction = "voicemail" | "end";
export type CallerIdDisplay = "original" | "transovo_number";

export const FORWARD_RING_PRESETS = [10, 15, 20, 25, 30] as const;
export const MAX_FORWARD_TARGETS = 5;

export type PersonalCallSettings = {
  incomingCallHandling: IncomingCallHandling;
  vaultIncomingMode: VaultIncomingMode;
  parkedMessageText: string;
  announcementText: string;
  announcementUrl: string | null;
  forwardingEnabled: boolean;
  forwardMode: ForwardMode;
  forwardTargets: string[];
  forwardRingSeconds: number;
  forwardUnansweredAction: ForwardUnansweredAction;
  forwardBusyAction: ForwardFallbackAction;
  forwardFailedAction: ForwardFallbackAction;
  voicemailEnabled: boolean;
  directVoicemail: boolean;
  callerIdDisplay: CallerIdDisplay;
  callScreeningEnabled: boolean;
  forwardScheduleMode: "always" | "custom";
  portOutAccountNumber: string | null;
  portOutPin: string | null;
  portOutLocked: boolean;
  voicemailSecondaryEmail: string | null;
  verificationWarningAcknowledged: boolean;
  blockedCallerAction: "disconnect" | "unavailable_message";
  forwardBusyNumber: string | null;
  forwardFailedNumber: string | null;
};

const DEFAULT_PARKED_MESSAGE =
  "This number is parked and is not accepting live calls right now.";

const DEFAULT_ANNOUNCEMENT =
  "This number is no longer in service. Please try again later.";

function readSettings(row: { settingsJson?: unknown }): Record<string, unknown> {
  return row.settingsJson && typeof row.settingsJson === "object"
    ? (row.settingsJson as Record<string, unknown>)
    : {};
}

function parseForwardTargets(
  settings: Record<string, unknown>,
  voiceForwardTo: string | null | undefined,
): string[] {
  const raw = settings.forwardTargets;
  if (Array.isArray(raw)) {
    const list = raw
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim())
      .slice(0, MAX_FORWARD_TARGETS);
    if (list.length > 0) return list;
  }
  if (voiceForwardTo?.trim()) return [voiceForwardTo.trim()];
  return [];
}

function parseFallbackAction(raw: unknown): ForwardFallbackAction {
  if (raw === "another_number" || raw === "announcement" || raw === "end") return raw;
  return "voicemail";
}

export function readPersonalCallSettings(row: {
  settingsJson?: unknown;
  voiceForwardTo?: string | null;
}): PersonalCallSettings {
  const settings = readSettings(row);
  const ringRaw = settings.forwardRingSeconds;
  const ringSeconds =
    typeof ringRaw === "number" && ringRaw >= 5 && ringRaw <= 60 ? ringRaw : 25;

  const unansweredRaw = settings.forwardUnansweredAction;
  const forwardUnansweredAction: ForwardUnansweredAction =
    unansweredRaw === "end" ? "end" : "voicemail";

  const vaultRaw = settings.vaultIncomingMode;
  const vaultIncomingMode: VaultIncomingMode =
    vaultRaw === "voicemail" ? "voicemail" : vaultRaw === "silent" ? "silent" : "parked_message";

  const handlingRaw = settings.incomingCallHandling;
  const incomingCallHandling: IncomingCallHandling =
    handlingRaw === "voicemail_only" || handlingRaw === "announcement_only"
      ? handlingRaw
      : "forward";

  const modeRaw = settings.forwardMode;
  const forwardMode: ForwardMode =
    modeRaw === "sequential" || modeRaw === "simultaneous" ? modeRaw : "single";

  const callerRaw = settings.callerIdDisplay;
  const callerIdDisplay: CallerIdDisplay =
    callerRaw === "transovo_number" ? "transovo_number" : "original";

  const forwardTargets = parseForwardTargets(settings, row.voiceForwardTo);

  return {
    incomingCallHandling,
    vaultIncomingMode,
    parkedMessageText:
      typeof settings.parkedMessageText === "string" && settings.parkedMessageText.trim()
        ? settings.parkedMessageText.trim()
        : DEFAULT_PARKED_MESSAGE,
    announcementText:
      typeof settings.announcementText === "string" && settings.announcementText.trim()
        ? settings.announcementText.trim()
        : DEFAULT_ANNOUNCEMENT,
    announcementUrl:
      typeof settings.announcementUrl === "string" && settings.announcementUrl.trim()
        ? settings.announcementUrl.trim()
        : null,
    forwardingEnabled:
      settings.forwardingEnabled === false
        ? false
        : Boolean(forwardTargets.length > 0 || row.voiceForwardTo?.trim()),
    forwardMode,
    forwardTargets,
    forwardRingSeconds: ringSeconds,
    forwardUnansweredAction,
    forwardBusyAction: parseFallbackAction(settings.forwardBusyAction),
    forwardFailedAction: parseFallbackAction(settings.forwardFailedAction),
    voicemailEnabled: settings.voicemailEnabled === true,
    directVoicemail: settings.directVoicemail === true,
    callerIdDisplay,
    callScreeningEnabled: settings.callScreeningEnabled === true,
    forwardScheduleMode:
      settings.forwardScheduleMode === "custom" ? "custom" : "always",
    portOutAccountNumber:
      typeof settings.portOutAccountNumber === "string"
        ? settings.portOutAccountNumber.trim() || null
        : null,
    portOutPin:
      typeof settings.portOutPin === "string" ? settings.portOutPin.trim() || null : null,
    portOutLocked: settings.portOutLocked !== false,
    voicemailSecondaryEmail:
      typeof settings.voicemailSecondaryEmail === "string"
        ? settings.voicemailSecondaryEmail.trim() || null
        : null,
    verificationWarningAcknowledged: settings.verificationWarningAcknowledged === true,
    blockedCallerAction:
      settings.blockedCallerAction === "unavailable_message"
        ? "unavailable_message"
        : "disconnect",
    forwardBusyNumber:
      typeof settings.forwardBusyNumber === "string"
        ? settings.forwardBusyNumber.trim() || null
        : null,
    forwardFailedNumber:
      typeof settings.forwardFailedNumber === "string"
        ? settings.forwardFailedNumber.trim() || null
        : null,
  };
}

export function isPersonalNumberParked(row: { settingsJson?: unknown }): boolean {
  const settings = readSettings(row);
  return (
    settings.parked === true ||
    settings.personalParked === true ||
    settings.personalServiceState === "PARKED" ||
    settings.personalServiceState === "PARKED_VOICEMAIL"
  );
}

export function derivePersonalDisplayState(
  row: { settingsJson?: unknown; voiceForwardTo?: string | null },
): string {
  const settings = readSettings(row);
  if (isPersonalNumberParked(row)) {
    const callSettings = readPersonalCallSettings(row);
    if (
      callSettings.vaultIncomingMode === "voicemail" &&
      callSettings.voicemailEnabled
    ) {
      return "PARKED_VOICEMAIL";
    }
    return "PARKED";
  }
  if (settings.routingOwner === "smart_routing") return "SMART_ROUTING";
  const callSettings = readPersonalCallSettings(row);
  if (callSettings.incomingCallHandling === "announcement_only") return "ANNOUNCEMENT";
  if (callSettings.forwardingEnabled && callSettings.forwardTargets.length > 0) {
    return "FORWARDING";
  }
  if (callSettings.voicemailEnabled || callSettings.directVoicemail) return "VOICEMAIL";
  return "ACTIVE";
}

export type PersonalCallSettingsPatch = Partial<{
  incomingCallHandling: IncomingCallHandling;
  vaultIncomingMode: VaultIncomingMode;
  parkedMessageText: string;
  announcementText: string;
  announcementUrl: string | null;
  forwardingEnabled: boolean;
  forwardMode: ForwardMode;
  forwardTargets: string[];
  forwardRingSeconds: number;
  forwardUnansweredAction: ForwardUnansweredAction;
  forwardBusyAction: ForwardFallbackAction;
  forwardFailedAction: ForwardFallbackAction;
  voicemailEnabled: boolean;
  directVoicemail: boolean;
  callerIdDisplay: CallerIdDisplay;
  callScreeningEnabled: boolean;
  forwardScheduleMode: "always" | "custom";
  portOutAccountNumber: string | null;
  portOutPin: string | null;
  portOutLocked: boolean;
  voicemailSecondaryEmail: string | null;
  verificationWarningAcknowledged: boolean;
  blockedCallerAction: "disconnect" | "unavailable_message";
  forwardBusyNumber: string | null;
  forwardFailedNumber: string | null;
  forwardSchedule: Record<string, unknown> | null;
}>;

export function mergePersonalCallSettingsPatch(
  existing: Record<string, unknown>,
  patch: PersonalCallSettingsPatch,
): Record<string, unknown> {
  const next = { ...existing };
  if (patch.incomingCallHandling !== undefined) {
    next.incomingCallHandling = patch.incomingCallHandling;
  }
  if (patch.vaultIncomingMode !== undefined) {
    next.vaultIncomingMode = patch.vaultIncomingMode;
  }
  if (patch.parkedMessageText !== undefined) {
    next.parkedMessageText = patch.parkedMessageText.trim();
  }
  if (patch.announcementText !== undefined) {
    next.announcementText = patch.announcementText.trim();
  }
  if (patch.announcementUrl !== undefined) {
    next.announcementUrl = patch.announcementUrl?.trim() || null;
  }
  if (patch.forwardRingSeconds !== undefined) {
    next.forwardRingSeconds = patch.forwardRingSeconds;
  }
  if (patch.forwardUnansweredAction !== undefined) {
    next.forwardUnansweredAction = patch.forwardUnansweredAction;
  }
  if (patch.forwardBusyAction !== undefined) {
    next.forwardBusyAction = patch.forwardBusyAction;
  }
  if (patch.forwardFailedAction !== undefined) {
    next.forwardFailedAction = patch.forwardFailedAction;
  }
  if (patch.voicemailEnabled !== undefined) {
    next.voicemailEnabled = patch.voicemailEnabled;
  }
  if (patch.directVoicemail !== undefined) {
    next.directVoicemail = patch.directVoicemail;
  }
  if (patch.forwardingEnabled !== undefined) {
    next.forwardingEnabled = patch.forwardingEnabled;
  }
  if (patch.forwardMode !== undefined) {
    next.forwardMode = patch.forwardMode;
  }
  if (patch.forwardTargets !== undefined) {
    next.forwardTargets = patch.forwardTargets.slice(0, MAX_FORWARD_TARGETS);
  }
  if (patch.callerIdDisplay !== undefined) {
    next.callerIdDisplay = patch.callerIdDisplay;
  }
  if (patch.callScreeningEnabled !== undefined) {
    next.callScreeningEnabled = patch.callScreeningEnabled;
  }
  if (patch.forwardScheduleMode !== undefined) {
    next.forwardScheduleMode = patch.forwardScheduleMode;
  }
  if (patch.portOutAccountNumber !== undefined) {
    next.portOutAccountNumber = patch.portOutAccountNumber;
  }
  if (patch.portOutPin !== undefined) {
    next.portOutPin = patch.portOutPin;
  }
  if (patch.portOutLocked !== undefined) {
    next.portOutLocked = patch.portOutLocked;
  }
  if (patch.voicemailSecondaryEmail !== undefined) {
    next.voicemailSecondaryEmail = patch.voicemailSecondaryEmail;
  }
  if (patch.verificationWarningAcknowledged !== undefined) {
    next.verificationWarningAcknowledged = patch.verificationWarningAcknowledged;
  }
  if (patch.blockedCallerAction !== undefined) {
    next.blockedCallerAction = patch.blockedCallerAction;
  }
  if (patch.forwardBusyNumber !== undefined) {
    next.forwardBusyNumber = patch.forwardBusyNumber;
  }
  if (patch.forwardFailedNumber !== undefined) {
    next.forwardFailedNumber = patch.forwardFailedNumber;
  }
  if (patch.forwardSchedule !== undefined) {
    next.forwardSchedule = patch.forwardSchedule;
  }
  return next;
}

export const PERSONAL_UNAVAILABLE_MESSAGE =
  "This number is not available right now. Please try again later.";

export const PERSONAL_VERIFICATION_WARNING =
  "Using this number for verification codes? Some banks, apps and services may not accept virtual or VoIP numbers for verification — especially after a port.";
