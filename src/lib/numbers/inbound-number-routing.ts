/**
 * Per-number inbound behavior from PhoneNumber row (vault / forward / voicemail).
 * Smart Routing and IVR run earlier in the voice webhook; this layer applies
 * number-product lifecycle state before generic softphone rules.
 */

import type { PhoneNumber } from "@prisma/client";

export type NumberInboundRoute =
  | { kind: "parked" }
  | { kind: "forward"; destination: string }
  | { kind: "voicemail" }
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

  const parked =
    settings.parked === true ||
    settings.personalParked === true ||
    settings.personalServiceState === "PARKED";

  if (parked) {
    return { kind: "parked" };
  }

  if (row.voiceForwardTo?.trim()) {
    return { kind: "forward", destination: row.voiceForwardTo.trim() };
  }

  if (settings.voicemailEnabled === true) {
    return { kind: "voicemail" };
  }

  return { kind: "default" };
}
