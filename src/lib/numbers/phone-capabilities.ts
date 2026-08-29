/**
 * Independent phone-number capabilities — SMS, voice, AI After Hours, and MCTB
 * are not mutually exclusive at the application layer.
 */

import { isPhoneMctbSipIngress } from "@/lib/mctb/sip-ingress/sync";

export type PhoneCapabilityFlags = {
  smsEnabled: boolean;
  voiceEnabled: boolean;
  aiAfterHoursEnabled: boolean;
  mctbEnabled: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readExplicitBool(
  settings: Record<string, unknown>,
  key: keyof PhoneCapabilityFlags,
): boolean | null {
  const caps = asRecord(settings.capabilities);
  if (typeof caps[key] === "boolean") return caps[key] as boolean;
  if (typeof settings[key] === "boolean") return settings[key] as boolean;
  return null;
}

export function readPhoneCapabilities(input: {
  settingsJson?: unknown;
  capabilitiesJson?: unknown;
}): PhoneCapabilityFlags {
  const settings = asRecord(input.settingsJson);
  const capabilities = asRecord(input.capabilitiesJson);

  const smsExplicit =
    readExplicitBool(settings, "smsEnabled") ??
    (capabilities.sms === true || capabilities.messaging === true ? true : null);

  const mctbExplicit =
    readExplicitBool(settings, "mctbEnabled") ??
    (isPhoneMctbSipIngress(input.settingsJson) ? true : null);

  const aiExplicit = readExplicitBool(settings, "aiAfterHoursEnabled");

  const voiceExplicit =
    readExplicitBool(settings, "voiceEnabled") ??
    (capabilities.voice === true ? true : null);

  const telephony = asRecord(settings.telephony);
  const provisioning = asRecord(settings.provisioning);
  const routingMode = String(
    telephony.routingMode || provisioning.routingMode || "",
  ).toLowerCase();
  const livekitVoice =
    routingMode === "livekit_sip" || routingMode === "livekit" || aiExplicit === true;

  return {
    smsEnabled: smsExplicit ?? true,
    voiceEnabled: voiceExplicit ?? (livekitVoice || mctbExplicit === true),
    aiAfterHoursEnabled: aiExplicit ?? livekitVoice,
    mctbEnabled: mctbExplicit ?? false,
  };
}

export function mergePhoneCapabilitySettings(
  settingsJson: unknown,
  patch: Partial<PhoneCapabilityFlags>,
): Record<string, unknown> {
  const settings = { ...asRecord(settingsJson) };
  const capabilities = { ...asRecord(settings.capabilities) };
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === "boolean") {
      capabilities[key] = value;
      settings[key as keyof PhoneCapabilityFlags] = value;
    }
  }
  settings.capabilities = capabilities;
  return settings;
}
