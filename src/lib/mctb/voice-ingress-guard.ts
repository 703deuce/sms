import "server-only";

import { getPrisma } from "@/lib/db";
import {
  isMctbTexmlIngressLocked,
  isPhoneMctbSipIngress,
  readPhoneMctbSettings,
} from "@/lib/mctb/sip-ingress/sync";
import {
  MCTB_TEXML_ROUTING_MODE,
  MCTB_TEXML_ROUTING_OWNER,
} from "@/lib/mctb/texml-ingress/constants";

/** Canonical MCTB voice path — frozen TeXML pipeline (mctb_texml_final_v1). */
export const MCTB_CANONICAL_ROUTING_MODE = MCTB_TEXML_ROUTING_MODE;
export const MCTB_CANONICAL_ROUTING_OWNER = MCTB_TEXML_ROUTING_OWNER;
export const MCTB_CANONICAL_CONSENT_PATH = "mctb_texml" as const;

export function isMctbCanonicalVoiceSettings(settingsJson: unknown): boolean {
  const settings = readPhoneMctbSettings(settingsJson);
  if (settings.routingOwner === MCTB_TEXML_ROUTING_OWNER) return true;
  return isMctbTexmlRoutingMode(settingsJson);
}

export function isMctbTexmlRoutingMode(settingsJson: unknown): boolean {
  const settings = readPhoneMctbSettings(settingsJson);
  const telephony = settings.telephony;
  if (!telephony || typeof telephony !== "object" || Array.isArray(telephony)) return false;
  return (telephony as Record<string, unknown>).routingMode === MCTB_TEXML_ROUTING_MODE;
}

/** MCTB-dedicated DIDs must not be stolen to generic Transovo Voice / LiveKit routing. */
export function isMctbVoiceRouteLocked(settingsJson: unknown): boolean {
  if (isMctbTexmlIngressLocked(settingsJson)) return true;
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
    `mctb_voice_route_locked:${input.operation}: ${row.e164 || input.providerNumberId} is dedicated MCTB voice ingress`,
  );
}

/** Remove LiveKit / legacy FQDN metadata when locking a DID to MCTB TeXML. */
export function scrubCompetingIngressTelephonyFields(
  telephony: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...telephony };
  for (const key of [
    "telnyxFqdnId",
    "telnyxFqdnConnectionId",
    "livekitDispatchRuleId",
    "livekitInboundTrunkId",
    "livekitOutboundTrunkId",
    "livekitDidDispatchRuleId",
    "explicitDispatch",
  ]) {
    delete next[key];
  }
  return next;
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
