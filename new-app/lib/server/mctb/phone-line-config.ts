import "server-only";

import { normalizeMctbConsentMode, type MctbConsentMode } from "@/lib/mctb/consent-mode";

export type PhoneMctbInboundSettings = {
  enabled: boolean;
  consentMode: MctbConsentMode;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readPhoneMctbInbound(settingsJson: unknown): PhoneMctbInboundSettings {
  const inbound = asRecord(asRecord(settingsJson).mctbInbound);
  return {
    enabled: inbound.enabled === true,
    consentMode: normalizeMctbConsentMode(inbound.consentMode),
  };
}

export function mergePhoneMctbInbound(
  settingsJson: unknown,
  patch: Partial<PhoneMctbInboundSettings>,
): Record<string, unknown> {
  const settings = asRecord(settingsJson);
  const inbound = asRecord(settings.mctbInbound);
  const next = {
    ...inbound,
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.consentMode !== undefined ? { consentMode: patch.consentMode } : {}),
  };
  return { ...settings, mctbInbound: next };
}
