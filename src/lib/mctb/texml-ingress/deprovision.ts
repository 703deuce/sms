import "server-only";

import { getPrisma } from "@/lib/db";
import { invalidateMctbTexmlIngressCache } from "./config-cache";
import {
  isMctbTexmlIngressConnection,
  unroutePhoneFromMctbTexmlIngress,
} from "./texml-route";

function telephonyRecord(settingsJson: unknown): Record<string, unknown> {
  const settings =
    settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
      ? (settingsJson as Record<string, unknown>)
      : {};
  const telephony = settings.telephony;
  return telephony && typeof telephony === "object" && !Array.isArray(telephony)
    ? (telephony as Record<string, unknown>)
    : {};
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Clear MCTB TeXML ingress metadata and restore Telnyx routing when possible. */
export async function releaseMctbTexmlIngressFromPhone(input: {
  workspaceId?: string;
  phoneNumberId: string;
}): Promise<{ ok: boolean; e164: string | null; telnyxRestored?: boolean; error?: string }> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: input.workspaceId
      ? { id: input.phoneNumberId, workspaceId: input.workspaceId }
      : { id: input.phoneNumberId },
    select: {
      id: true,
      e164: true,
      providerNumberId: true,
      settingsJson: true,
    },
  });
  if (!phone) return { ok: false, e164: null, error: "phone_not_found" };

  const telephony = telephonyRecord(phone.settingsJson);
  let restoreConnectionId = String(telephony.mctbTexmlPreviousConnectionId || "").trim();
  let liveConnectionId: string | null = null;
  let telnyxRestored = false;

  if (phone.providerNumberId) {
    const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
    const before = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/phone_numbers/${encodeURIComponent(phone.providerNumberId)}`,
    );
    liveConnectionId =
      String((asRecord(before.data) || asRecord(before) || {}).connection_id || "") || null;

    if (
      !restoreConnectionId &&
      liveConnectionId &&
      !isMctbTexmlIngressConnection(liveConnectionId)
    ) {
      telnyxRestored = true;
    }

    if (
      !restoreConnectionId &&
      liveConnectionId &&
      isMctbTexmlIngressConnection(liveConnectionId)
    ) {
      return {
        ok: false,
        e164: phone.e164,
        telnyxRestored: false,
        error: "missing_restore_connection_id",
      };
    }

    if (restoreConnectionId) {
      try {
        const unrouted = await unroutePhoneFromMctbTexmlIngress({
          e164: phone.e164,
          providerNumberId: phone.providerNumberId,
          restoreConnectionId,
        });
        telnyxRestored = unrouted.ok;
        if (!unrouted.ok) {
          return {
            ok: false,
            e164: phone.e164,
            telnyxRestored: false,
            error: "telnyx_unroute_failed",
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, e164: phone.e164, telnyxRestored: false, error: message || "telnyx_unroute_failed" };
      }
    }
  }

  const settings =
    phone.settingsJson && typeof phone.settingsJson === "object" && !Array.isArray(phone.settingsJson)
      ? { ...(phone.settingsJson as Record<string, unknown>) }
      : {};

  settings.mctbSipIngress = false;
  settings.routingOwner = null;
  delete settings.mctbRole;

  const nextTelephony =
    settings.telephony && typeof settings.telephony === "object" && !Array.isArray(settings.telephony)
      ? { ...(settings.telephony as Record<string, unknown>) }
      : {};
  delete nextTelephony.routingMode;
  delete nextTelephony.routingOwner;
  delete nextTelephony.telnyxTexmlAppId;
  delete nextTelephony.mctbTexmlPreviousConnectionId;
  delete nextTelephony.state;
  settings.telephony = nextTelephony;

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: { settingsJson: settings as object },
  });

  if (phone.e164) invalidateMctbTexmlIngressCache(phone.e164);

  return { ok: true, e164: phone.e164, telnyxRestored };
}
