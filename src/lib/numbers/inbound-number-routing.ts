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
  | { kind: "vault_message"; message: string }
  | { kind: "vault_voicemail" }
  | {
      kind: "forward";
      destination: string;
      ringSeconds: number;
      unansweredAction: ForwardUnansweredAction;
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
    return { kind: "vault_message", message: callSettings.parkedMessageText };
  }

  if (callSettings.forwardingEnabled && row.voiceForwardTo?.trim()) {
    return {
      kind: "forward",
      destination: row.voiceForwardTo.trim(),
      ringSeconds: callSettings.forwardRingSeconds,
      unansweredAction: callSettings.forwardUnansweredAction,
    };
  }

  if (callSettings.voicemailEnabled || callSettings.directVoicemail) {
    return { kind: "voicemail" };
  }

  return { kind: "unavailable" };
}
