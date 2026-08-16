/**
 * Per-number inbound behavior from PhoneNumber row (vault / forward / voicemail).
 * Smart Routing and IVR run earlier in the voice webhook; this layer applies
 * number-product lifecycle state before generic softphone rules.
 */

import type { PhoneNumber } from "@prisma/client";
import {
  isPersonalNumberParked,
  readPersonalCallSettings,
  type ForwardUnansweredAction,
} from "./personal-call-settings";

export type NumberInboundRoute =
  | { kind: "vault_silent" }
  | { kind: "vault_message"; message: string }
  | { kind: "vault_voicemail" }
  | { kind: "announcement"; message: string }
  | {
      kind: "forward";
      destinations: string[];
      mode: "single" | "sequential" | "simultaneous";
      ringSeconds: number;
      unansweredAction: ForwardUnansweredAction;
      callScreening: boolean;
      callerIdDisplay: "original" | "transovo_number";
    }
  | { kind: "voicemail" }
  | { kind: "unavailable" }
  | { kind: "default" };

function readSettings(row: PhoneNumber): Record<string, unknown> {
  return row.settingsJson && typeof row.settingsJson === "object"
    ? (row.settingsJson as Record<string, unknown>)
    : {};
}

export function resolveNumberInboundRoute(row: PhoneNumber): NumberInboundRoute {
  const settings = readSettings(row);
  const routingOwner = settings.routingOwner as string | undefined;

  if (routingOwner === "smart_routing") {
    return { kind: "default" };
  }

  const callSettings = readPersonalCallSettings(row);

  if (isPersonalNumberParked(row)) {
    if (callSettings.vaultIncomingMode === "voicemail" && callSettings.voicemailEnabled) {
      return { kind: "vault_voicemail" };
    }
    if (callSettings.vaultIncomingMode === "silent") {
      return { kind: "vault_silent" };
    }
    return { kind: "vault_message", message: callSettings.parkedMessageText };
  }

  if (callSettings.incomingCallHandling === "announcement_only") {
    return { kind: "announcement", message: callSettings.announcementText };
  }

  if (
    callSettings.incomingCallHandling === "forward" &&
    callSettings.forwardingEnabled &&
    callSettings.forwardTargets.length > 0
  ) {
    return {
      kind: "forward",
      destinations: callSettings.forwardTargets,
      mode: callSettings.forwardMode,
      ringSeconds: callSettings.forwardRingSeconds,
      unansweredAction: callSettings.forwardUnansweredAction,
      callScreening: callSettings.callScreeningEnabled,
      callerIdDisplay: callSettings.callerIdDisplay,
    };
  }

  if (callSettings.voicemailEnabled || callSettings.directVoicemail) {
    return { kind: "voicemail" };
  }

  if (callSettings.incomingCallHandling === "voicemail_only") {
    return { kind: "voicemail" };
  }

  return { kind: "unavailable" };
}
