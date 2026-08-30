import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  MCTB_TEXML_ROUTING_MODE,
  MCTB_TEXML_ROUTING_OWNER,
} from "@/lib/mctb/texml-ingress/constants";

function normalizeDid(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.startsWith("+") ? value : null;
}

export function readPhoneMctbSettings(settingsJson: unknown): Record<string, unknown> {
  return settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
    ? (settingsJson as Record<string, unknown>)
    : {};
}

export function isPhoneMctbSipIngress(settingsJson: unknown): boolean {
  const settings = readPhoneMctbSettings(settingsJson);
  if (settings.mctbSipIngress === true) return true;
  const role = String(settings.mctbRole || "").toLowerCase();
  return role === "platform_demo" || role === "customer_mctb" || role === "mctb_sip";
}

/** TeXML-first MCTB ingress (carrier → DID → TeXML → Gather). */
export function isMctbTexmlVoiceIngress(settingsJson: unknown): boolean {
  const settings = readPhoneMctbSettings(settingsJson);
  const telephony = settings.telephony;
  if (!telephony || typeof telephony !== "object" || Array.isArray(telephony)) return false;
  return (telephony as Record<string, unknown>).routingMode === MCTB_TEXML_ROUTING_MODE;
}

/** DID is locked to MCTB TeXML — refuse LiveKit FQDN / agent reprovision steals.
 *  See docs/MCTB_FINAL_PRODUCTION_PIPELINE.md (mctb_texml_final_v1). */
export function isMctbTexmlIngressLocked(settingsJson: unknown): boolean {
  const settings = readPhoneMctbSettings(settingsJson);
  if (settings.routingOwner === MCTB_TEXML_ROUTING_OWNER) return true;
  return isMctbTexmlVoiceIngress(settingsJson);
}

export class MctbTexmlProvisionLockedError extends Error {
  readonly code = "mctb_texml_locked";

  constructor(operation: string) {
    super(`${operation}: number is locked to MCTB TeXML ingress — generic voice provision refused`);
    this.name = "MctbTexmlProvisionLockedError";
  }
}

/** Refuse generic Transovo Voice / LiveKit reprovision on MCTB TeXML-locked DIDs. */
export function assertNotMctbLockedForGenericVoiceProvision(
  settingsJson: unknown,
  operation: string,
): void {
  if (!isMctbTexmlIngressLocked(settingsJson)) return;
  throw new MctbTexmlProvisionLockedError(operation);
}

function envAllowlist(): Set<string> {
  const raw = process.env.MCTB_SIP_INGRESS_E164S?.trim();
  const values = new Set<string>();
  if (raw) {
    for (const part of raw.split(",")) {
      const normalized = normalizeDid(part.trim());
      if (normalized) values.add(normalized);
    }
  }
  const platform = normalizeDid(MCTB_PLATFORM_DEMO_E164);
  if (platform) values.add(platform);
  return values;
}

/** Sync fast-path for platform demo env + optional MCTB_SIP_INGRESS_E164S — does not hit DB. */
export function isMctbSipIngressTargetSync(toE164: string | null | undefined): boolean {
  const normalized = normalizeDid(toE164);
  if (!normalized) return false;
  return envAllowlist().has(normalized);
}
