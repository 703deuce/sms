/**
 * Telnyx port-out credentials for Personal numbers.
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { readPersonalCallSettings } from "./personal-call-settings";

function randomPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

type TelnyxPhoneNumber = {
  id?: string;
  phone_number?: string;
  billing_group_id?: string;
  port_out_pin?: string | null;
  customer_reference?: string | null;
};

export async function syncPersonalPortOutFromTelnyx(
  workspaceId: string,
  numberId: string,
): Promise<{
  accountNumber: string | null;
  pin: string | null;
  telnyxSynced: boolean;
}> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row?.providerNumberId) {
    return { accountNumber: null, pin: null, telnyxSynced: false };
  }

  const res = await telnyxRequest<{ data?: TelnyxPhoneNumber }>(
    `/phone_numbers/${encodeURIComponent(row.providerNumberId)}`,
    { method: "GET" },
  ).catch(() => null);

  const data = res?.data;
  if (!data) {
    return { accountNumber: null, pin: null, telnyxSynced: false };
  }

  const accountNumber =
    data.billing_group_id
      ? String(data.billing_group_id)
      : data.customer_reference
        ? String(data.customer_reference)
        : String(data.id || row.providerNumberId);

  const pin =
    data.port_out_pin && String(data.port_out_pin).trim()
      ? String(data.port_out_pin).trim()
      : null;

  const settings =
    row.settingsJson && typeof row.settingsJson === "object"
      ? { ...(row.settingsJson as Record<string, unknown>) }
      : {};

  settings.portOutAccountNumber = accountNumber;
  if (pin) settings.portOutPin = pin;

  await prisma.phoneNumber.update({
    where: { id: numberId },
    data: { settingsJson: settings },
  });

  return { accountNumber, pin, telnyxSynced: true };
}

export async function setPersonalPortOutPin(
  workspaceId: string,
  numberId: string,
  pin: string,
  locked: boolean,
): Promise<{ pin: string; accountNumber: string | null }> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row) throw new Error("Number not found");

  const normalizedPin = pin.trim() || randomPin();
  const settings =
    row.settingsJson && typeof row.settingsJson === "object"
      ? { ...(row.settingsJson as Record<string, unknown>) }
      : {};

  if (row.providerNumberId && !row.providerNumberId.startsWith("ORDER:")) {
    const telnyxRes = await telnyxRequest(
      `/phone_numbers/${encodeURIComponent(row.providerNumberId)}`,
      {
        method: "PATCH",
        body: { port_out_pin: normalizedPin },
      },
    ).catch((err) => {
      console.warn("[port-out] Telnyx PIN update failed:", err);
      return null;
    });
    if (telnyxRes === null) {
      // Keep local PIN so customer can still request port-out from new carrier.
    }
  }

  settings.portOutPin = normalizedPin;
  settings.portOutLocked = locked;

  const existing = readPersonalCallSettings({
    settingsJson: settings,
    voiceForwardTo: row.voiceForwardTo,
  });

  if (!existing.portOutAccountNumber) {
    settings.portOutAccountNumber =
      row.providerNumberId || row.e164.replace(/\D/g, "").slice(-10);
  }

  await prisma.phoneNumber.update({
    where: { id: numberId },
    data: { settingsJson: settings },
  });

  return {
    pin: normalizedPin,
    accountNumber: (settings.portOutAccountNumber as string) || null,
  };
}

export async function revealPersonalPortOutCredentials(
  workspaceId: string,
  numberId: string,
): Promise<{ accountNumber: string; pin: string | null; locked: boolean }> {
  const synced = await syncPersonalPortOutFromTelnyx(workspaceId, numberId);
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row) throw new Error("Number not found");

  const callSettings = readPersonalCallSettings({
    settingsJson: row.settingsJson,
    voiceForwardTo: row.voiceForwardTo,
  });

  let pin = callSettings.portOutPin || synced.pin;
  if (!pin && !callSettings.portOutLocked) {
    const set = await setPersonalPortOutPin(workspaceId, numberId, randomPin(), false);
    pin = set.pin;
  }

  const accountNumber =
    callSettings.portOutAccountNumber ||
    synced.accountNumber ||
    row.e164.replace(/\D/g, "").slice(-10);

  return {
    accountNumber,
    pin: callSettings.portOutLocked ? null : pin,
    locked: callSettings.portOutLocked,
  };
}
