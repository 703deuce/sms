import { normalizeE164 } from "@/lib/server/phone/normalize";
import { getOrCreateWorkspaceCrmSettings } from "./crm-settings";

function countryFromE164(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.startsWith("1") && d.length === 11) return "US";
  if (d.startsWith("44")) return "GB";
  if (d.startsWith("61")) return "AU";
  if (d.startsWith("49")) return "DE";
  return d.slice(0, 3) || "UNKNOWN";
}

/** M19 — block dial when destination country is restricted. */
export async function assertOutboundDialAllowed(workspaceId: string, toE164: string) {
  const settings = await getOrCreateWorkspaceCrmSettings(workspaceId);
  const e164 = normalizeE164(toE164);
  const cc = countryFromE164(e164);
  if (settings.blockedCountries.includes(cc)) {
    throw new Error(`Outbound calls to ${cc} are blocked for this workspace`);
  }
  if (settings.allowedCountries.length > 0 && !settings.allowedCountries.includes(cc)) {
    throw new Error(`Outbound calls to ${cc} are not in the allowed country list`);
  }
  return { e164, country: cc, defaultCountryCode: settings.defaultCountryCode };
}
