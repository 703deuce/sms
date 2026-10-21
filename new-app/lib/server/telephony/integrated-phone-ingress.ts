import "server-only";

import { readTelephonyProvision, type TelephonyProvisionRecord } from "@/lib/server/telephony/telephony-record";

/** One Call Control ingress; features are configuration, not separate carrier products. */
export type TelephonyIngressModel = "exclusive_product" | "phone_foundation";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function readIngressModel(settingsJson: unknown): TelephonyIngressModel {
  const settings = asRecord(settingsJson) || {};
  const telephony = asRecord(settings.telephony) || {};
  const raw = telephony.ingressModel ?? settings.phoneFoundationIngress;
  if (raw === true || raw === "phone_foundation") return "phone_foundation";
  return "exclusive_product";
}

export function isPhoneFoundationIngress(settingsJson: unknown): boolean {
  return readIngressModel(settingsJson) === "phone_foundation";
}

/**
 * Whether inbound PSTN for this number should be handled on Telnyx Call Control
 * (forwarding, browser, AI handoff, owned-number MCTB), regardless of legacy
 * `routingMode` rows left from pre-migration exclusive product switches.
 */
export function usesPhoneCallControlRuntime(settingsJson: unknown): boolean {
  if (isPhoneFoundationIngress(settingsJson)) return true;
  const telephony = readTelephonyProvision(settingsJson);
  return telephony.routingMode === "telnyx_call_control" && telephony.state === "active";
}

export function readLiveKitHandoffRecord(settingsJson: unknown): {
  trunkId?: string;
  dispatchRuleId?: string;
  fqdnConnectionId?: string;
} {
  const settings = asRecord(settingsJson) || {};
  const telephony = asRecord(settings.telephony) || {};
  const handoff = asRecord(telephony.liveKitHandoff) || {};
  return {
    trunkId: handoff.trunkId ? String(handoff.trunkId) : undefined,
    dispatchRuleId: handoff.dispatchRuleId ? String(handoff.dispatchRuleId) : undefined,
    fqdnConnectionId: handoff.fqdnConnectionId ? String(handoff.fqdnConnectionId) : undefined,
  };
}

export function mergeTelephonySettingsPatch(
  settingsJson: unknown,
  patch: {
    ingressModel?: TelephonyIngressModel;
    telephony?: Partial<TelephonyProvisionRecord>;
    liveKitHandoff?: Record<string, unknown>;
    mctbInbound?: Record<string, unknown>;
  },
): object {
  const settings = asRecord(settingsJson) || {};
  const prevTelephony = asRecord(settings.telephony) || {};
  const nextTelephony = {
    ...prevTelephony,
    ...(patch.telephony || {}),
    ...(patch.ingressModel ? { ingressModel: patch.ingressModel } : {}),
    ...(patch.liveKitHandoff
      ? { liveKitHandoff: { ...(asRecord(prevTelephony.liveKitHandoff) || {}), ...patch.liveKitHandoff } }
      : {}),
  };
  const next = {
    ...settings,
    telephony: nextTelephony,
    ...(patch.mctbInbound
      ? {
          mctbInbound: {
            ...(asRecord(settings.mctbInbound) || {}),
            ...patch.mctbInbound,
          },
        }
      : {}),
  };
  return next;
}
