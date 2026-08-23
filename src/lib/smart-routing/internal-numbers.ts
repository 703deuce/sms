import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export function sameSmartRoutingE164(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  if (da === db) return true;
  if (da.length === 10 && db === `1${da}`) return true;
  if (db.length === 10 && da === `1${db}`) return true;
  return false;
}

export function isWorkspaceInternalSmartRoutingNumberSync(
  settings: {
    routingNumberE164?: string | null;
    callbackNumberE164?: string | null;
  } | null,
  e164: string,
): boolean {
  if (!settings) return false;
  const n = normalizeE164(e164);
  if (settings.routingNumberE164 && sameSmartRoutingE164(settings.routingNumberE164, n)) {
    return true;
  }
  if (settings.callbackNumberE164 && sameSmartRoutingE164(settings.callbackNumberE164, n)) {
    return true;
  }
  return false;
}
