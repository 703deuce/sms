import "server-only";

import { getPrisma } from "@/lib/db";
import {
  isPhoneMctbSipIngress,
  readPhoneMctbSettings,
} from "@/lib/mctb/sip-ingress/sync";

/** Canonical MCTB voice path — same as the working 866 forward test. */
export const MCTB_CANONICAL_ROUTING_MODE = "call_control_event_only" as const;
export const MCTB_CANONICAL_ROUTING_OWNER = "mctb_call_control" as const;
export const MCTB_CANONICAL_CONSENT_PATH = "fqdn_direct_event_only" as const;

export function isMctbCanonicalVoiceSettings(settingsJson: unknown): boolean {
  if (!isPhoneMctbSipIngress(settingsJson)) return false;
  const settings = readPhoneMctbSettings(settingsJson);
  if (settings.routingOwner !== MCTB_CANONICAL_ROUTING_OWNER) return false;
  const telephony = settings.telephony;
  if (!telephony || typeof telephony !== "object" || Array.isArray(telephony)) return false;
  return (telephony as Record<string, unknown>).routingMode === MCTB_CANONICAL_ROUTING_MODE;
}

/** MCTB numbers must never be pointed at Transovo Voice, TeXML, or LiveKit ingress. */
export function isMctbVoiceRouteLocked(settingsJson: unknown): boolean {
  return isPhoneMctbSipIngress(settingsJson);
}

export async function assertMctbVoiceRouteNotGenericTelnyx(input: {
  providerNumberId?: string | null;
  phoneNumberId?: string | null;
  operation: string;
}): Promise<void> {
  const prisma = getPrisma();
  const row = input.phoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: input.phoneNumberId },
        select: { settingsJson: true, e164: true },
      })
    : input.providerNumberId
      ? await prisma.phoneNumber.findFirst({
          where: { providerNumberId: input.providerNumberId },
          select: { settingsJson: true, e164: true },
        })
      : null;

  if (!row || !isMctbVoiceRouteLocked(row.settingsJson)) return;

  throw new Error(
    `mctb_voice_route_locked:${input.operation}: ${row.e164 || input.providerNumberId} is MCTB Call Control only (mctb-event-only)`,
  );
}

/** Drop legacy ingress metadata so only the canonical Call Control path is recorded. */
export function scrubLegacyMctbTelephonyFields(
  telephony: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...telephony };
  for (const key of [
    "telnyxTexmlAppId",
    "telnyxFqdnId",
    "telnyxFqdnConnectionId",
    "livekitDispatchRuleId",
    "livekitInboundTrunkId",
    "livekitOutboundTrunkId",
  ]) {
    delete next[key];
  }
  return next;
}
