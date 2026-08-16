import type { PhoneNumber } from "@prisma/client";

export type VaultIncomingMode = "parked_message" | "voicemail";
export type ForwardUnansweredAction = "voicemail" | "end";

export type PersonalCallSettings = {
  vaultIncomingMode: VaultIncomingMode;
  parkedMessageText: string;
  forwardingEnabled: boolean;
  forwardRingSeconds: number;
  forwardUnansweredAction: ForwardUnansweredAction;
  voicemailEnabled: boolean;
  directVoicemail: boolean;
};

const DEFAULT_PARKED_MESSAGE =
  "This number is parked and is not accepting live calls right now.";

function readSettings(row: { settingsJson?: unknown }): Record<string, unknown> {
  return row.settingsJson && typeof row.settingsJson === "object"
    ? (row.settingsJson as Record<string, unknown>)
    : {};
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
    vaultRaw === "voicemail" ? "voicemail" : "parked_message";

  return {
    vaultIncomingMode,
    parkedMessageText:
      typeof settings.parkedMessageText === "string" && settings.parkedMessageText.trim()
        ? settings.parkedMessageText.trim()
        : DEFAULT_PARKED_MESSAGE,
    forwardingEnabled:
      settings.forwardingEnabled === false ? false : Boolean(row.voiceForwardTo?.trim()),
    forwardRingSeconds: ringSeconds,
    forwardUnansweredAction,
    voicemailEnabled: settings.voicemailEnabled === true,
    directVoicemail: settings.directVoicemail === true,
  };
}

export function isPersonalNumberParked(row: { settingsJson?: unknown }): boolean {
  const settings = readSettings(row);
  return (
    settings.parked === true ||
    settings.personalParked === true ||
    settings.personalServiceState === "PARKED"
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
  if (callSettings.forwardingEnabled && row.voiceForwardTo) return "FORWARDING";
  if (callSettings.voicemailEnabled) return "VOICEMAIL";
  return "ACTIVE";
}

export function mergePersonalCallSettingsPatch(
  existing: Record<string, unknown>,
  patch: Partial<PersonalCallSettings>,
): Record<string, unknown> {
  const next = { ...existing };
  if (patch.vaultIncomingMode !== undefined) {
    next.vaultIncomingMode = patch.vaultIncomingMode;
  }
  if (patch.parkedMessageText !== undefined) {
    next.parkedMessageText = patch.parkedMessageText.trim();
  }
  if (patch.forwardRingSeconds !== undefined) {
    next.forwardRingSeconds = patch.forwardRingSeconds;
  }
  if (patch.forwardUnansweredAction !== undefined) {
    next.forwardUnansweredAction = patch.forwardUnansweredAction;
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
  return next;
}

export const PERSONAL_UNAVAILABLE_MESSAGE =
  "This number is not available right now. Please try again later.";
