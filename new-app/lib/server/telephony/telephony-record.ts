import "server-only";

import { getPrisma } from "@/lib/server/db";

export type VoiceRoutingMode = "livekit_sip" | "mctb_texml" | "telnyx_call_control";

export type TelephonyProvisionRecord = {
  routingMode?: VoiceRoutingMode;
  state?: "pending" | "provisioning" | "active" | "error" | "removed";
  telnyxFqdnConnectionId?: string;
  telnyxFqdnId?: string;
  telnyxConnectionId?: string;
  telnyxTexmlAppId?: string;
  livekitInboundTrunkId?: string;
  livekitDidDispatchRuleId?: string;
  lastProvisionedAt?: string;
  lastVerifiedAt?: string;
  lastError?: string | null;
  explicitDispatch?: Record<string, unknown>;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function readTelephonyProvision(settingsJson: unknown): TelephonyProvisionRecord {
  const settings = asRecord(settingsJson) || {};
  const telephony = asRecord(settings.telephony) || asRecord(settings.provisioning) || {};
  const nested = asRecord(telephony.provision);
  const merged = { ...telephony, ...(nested || {}) };
  return {
    routingMode: merged.routingMode as VoiceRoutingMode | undefined,
    state: merged.state as TelephonyProvisionRecord["state"],
    telnyxFqdnConnectionId: merged.telnyxFqdnConnectionId
      ? String(merged.telnyxFqdnConnectionId)
      : undefined,
    telnyxFqdnId: merged.telnyxFqdnId ? String(merged.telnyxFqdnId) : undefined,
    telnyxConnectionId: merged.telnyxConnectionId
      ? String(merged.telnyxConnectionId)
      : undefined,
    telnyxTexmlAppId: merged.telnyxTexmlAppId ? String(merged.telnyxTexmlAppId) : undefined,
    livekitInboundTrunkId: merged.livekitInboundTrunkId
      ? String(merged.livekitInboundTrunkId)
      : undefined,
    livekitDidDispatchRuleId: merged.livekitDidDispatchRuleId
      ? String(merged.livekitDidDispatchRuleId)
      : undefined,
    lastProvisionedAt: merged.lastProvisionedAt ? String(merged.lastProvisionedAt) : undefined,
    lastVerifiedAt: merged.lastVerifiedAt ? String(merged.lastVerifiedAt) : undefined,
    lastError: merged.lastError != null ? String(merged.lastError) : null,
    explicitDispatch: asRecord(merged.explicitDispatch) || undefined,
  };
}

export async function writeTelephonyProvision(
  phoneNumberId: string,
  patch: TelephonyProvisionRecord,
): Promise<TelephonyProvisionRecord> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findUnique({
    where: { id: phoneNumberId },
    select: { settingsJson: true },
  });
  const settings = asRecord(row?.settingsJson) || {};
  const prev = readTelephonyProvision(settings);
  const next: TelephonyProvisionRecord = {
    ...prev,
    ...patch,
    lastProvisionedAt: patch.lastProvisionedAt || new Date().toISOString(),
  };
  await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: {
      settingsJson: {
        ...settings,
        telephony: next,
      } as object,
    },
  });
  return next;
}
