import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_FQDN_DIRECT_TEST_E164 } from "@/lib/mctb/sip-diagnostic/constants";

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
  const fqdnDirect = normalizeDid(MCTB_FQDN_DIRECT_TEST_E164);
  if (fqdnDirect) values.add(fqdnDirect);
  return values;
}

/** Sync fast-path for platform demo env + optional MCTB_SIP_INGRESS_E164S — does not hit DB. */
export function isMctbSipIngressTargetSync(toE164: string | null | undefined): boolean {
  const normalized = normalizeDid(toE164);
  if (!normalized) return false;
  return envAllowlist().has(normalized);
}
