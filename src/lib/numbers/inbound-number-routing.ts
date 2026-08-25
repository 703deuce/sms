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
  type IncomingCallHandling,
} from "./personal-call-settings";
import { isSmartRoutingCallHandlingActive, readCallHandlingMode } from "./call-handling-mode-shared";
import { requiresPress1Screening, effectiveForwardRingSeconds } from "./forward-screening";
import {
  readPersonalForwardSchedule,
  resolveForwardSchedule,
} from "./personal-forward-schedule";

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
    return { kind: "unavailable" };
  }
  if (isSmartRoutingCallHandlingActive(settings)) {
    return { kind: "unavailable" };
  }

  if (routingOwner === "smart_routing_callback") {
    return { kind: "unavailable" };
  }

  const mode = readCallHandlingMode(settings);
  if (mode === "call_forwarding") {
    const cfSettings = readPersonalCallSettings(row);
    if (!cfSettings.forwardingEnabled || cfSettings.forwardTargets.length === 0) {
      return { kind: "unavailable" };
    }
  }

  const callSettings = readPersonalCallSettings(row);

  let handling: IncomingCallHandling = callSettings.incomingCallHandling;
  let targets = callSettings.forwardTargets;

  if (callSettings.forwardScheduleMode === "custom") {
    const schedule = readPersonalForwardSchedule(settings);
    if (schedule) {
      const resolved = resolveForwardSchedule(schedule);
      handling = resolved.handling;
      targets =
        resolved.targets.length > 0
          ? resolved.targets
          : resolved.handling === "forward"
            ? callSettings.forwardTargets
            : [];
    }
  }

  if (isPersonalNumberParked(row)) {
    if (callSettings.vaultIncomingMode === "voicemail" && callSettings.voicemailEnabled) {
      return { kind: "vault_voicemail" };
    }
    if (callSettings.vaultIncomingMode === "silent") {
      return { kind: "vault_silent" };
    }
    return { kind: "vault_message", message: callSettings.parkedMessageText };
  }

  if (handling === "announcement_only") {
    return { kind: "announcement", message: callSettings.announcementText };
  }

  if (
    handling === "forward" &&
    callSettings.forwardingEnabled &&
    targets.length > 0
  ) {
    return {
      kind: "forward",
      destinations: targets,
      mode: callSettings.forwardMode,
      ringSeconds: effectiveForwardRingSeconds(callSettings),
      unansweredAction: callSettings.forwardUnansweredAction,
      callScreening: requiresPress1Screening(callSettings),
      callerIdDisplay: callSettings.callerIdDisplay,
    };
  }

  if (handling === "voicemail_only" || callSettings.voicemailEnabled || callSettings.directVoicemail) {
    return { kind: "voicemail" };
  }

  return { kind: "unavailable" };
}
