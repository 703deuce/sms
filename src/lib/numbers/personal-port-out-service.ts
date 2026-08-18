/**
 * Port-out credentials for Personal numbers — Telnyx and Twilio paths.
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { resolvePhoneNumberProvider } from "./providers/normalize";
import type { NumberUpstreamProvider } from "./providers/types";
import { readPersonalCallSettings } from "./personal-call-settings";
import { syncPersonalPortOutFromTwilio } from "./twilio-port-out-service";
import { startPortAwayWindow } from "@/lib/workspace/personal-number-actions";
import { createPortOutRequest } from "./port-service";

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
  provider: "telnyx";
}> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row?.providerNumberId) {
    return { accountNumber: null, pin: null, telnyxSynced: false, provider: "telnyx" };
  }

  const res = await telnyxRequest<{ data?: TelnyxPhoneNumber }>(
    `/phone_numbers/${encodeURIComponent(row.providerNumberId)}`,
    { method: "GET" },
  ).catch(() => null);

  const data = res?.data;
  if (!data) {
    return { accountNumber: null, pin: null, telnyxSynced: false, provider: "telnyx" };
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

  return { accountNumber, pin, telnyxSynced: true, provider: "telnyx" };
}

export async function syncPersonalPortOutFromProvider(
  workspaceId: string,
  numberId: string,
): Promise<{
  accountNumber: string | null;
  pin: string | null;
  synced: boolean;
  provider: NumberUpstreamProvider;
}> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row) throw new Error("Number not found");

  const provider = resolvePhoneNumberProvider(row);
  if (provider === "twilio") {
    const twilio = await syncPersonalPortOutFromTwilio(workspaceId, numberId);
    return {
      accountNumber: twilio.accountNumber,
      pin: twilio.pin,
      synced: twilio.twilioSynced,
      provider: "twilio",
    };
  }

  const telnyx = await syncPersonalPortOutFromTelnyx(workspaceId, numberId);
  return {
    accountNumber: telnyx.accountNumber,
    pin: telnyx.pin,
    synced: telnyx.telnyxSynced,
    provider: "telnyx",
  };
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

  const provider = resolvePhoneNumberProvider(row);

  if (
    provider === "telnyx" &&
    row.providerNumberId &&
    !row.providerNumberId.startsWith("ORDER:")
  ) {
    await telnyxRequest(`/phone_numbers/${encodeURIComponent(row.providerNumberId)}`, {
      method: "PATCH",
      body: { port_out_pin: normalizedPin },
    }).catch((err) => {
      console.warn("[port-out] Telnyx PIN update failed:", err);
      return null;
    });
  }

  settings.portOutPin = normalizedPin;
  settings.portOutLocked = locked;

  const existing = readPersonalCallSettings({
    settingsJson: settings,
    voiceForwardTo: row.voiceForwardTo,
  });

  if (!existing.portOutAccountNumber) {
    if (provider === "twilio") {
      const twilioSync = await syncPersonalPortOutFromTwilio(workspaceId, numberId);
      if (!twilioSync.accountNumber) {
        settings.portOutAccountNumber = row.e164.replace(/\D/g, "").slice(-10);
      }
    } else {
      settings.portOutAccountNumber =
        row.providerNumberId || row.e164.replace(/\D/g, "").slice(-10);
    }
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
): Promise<{
  accountNumber: string;
  pin: string | null;
  locked: boolean;
  provider: NumberUpstreamProvider;
}> {
  const synced = await syncPersonalPortOutFromProvider(workspaceId, numberId);
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
    provider: synced.provider,
  };
}

export async function initiatePersonalPortOut(input: {
  workspaceId: string;
  userId: string;
  numberId: string;
  gainingCarrier?: string | null;
  gainingAccountNumber?: string | null;
  notes?: string | null;
}): Promise<{
  accountNumber: string;
  pin: string | null;
  provider: NumberUpstreamProvider;
  portRequestId: string;
  portAwayExpiresAt: string;
}> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: input.numberId, workspaceId: input.workspaceId },
  });
  if (!row) throw new Error("Number not found");

  const creds = await revealPersonalPortOutCredentials(input.workspaceId, input.numberId);
  if (creds.locked) {
    throw new Error(
      "Unlock port-out credentials before initiating. Your PIN is hidden while locked.",
    );
  }

  const refreshed = await revealPersonalPortOutCredentials(input.workspaceId, input.numberId);
  const portAway = await startPortAwayWindow(input.workspaceId, input.numberId);

  const settings =
    row.settingsJson && typeof row.settingsJson === "object"
      ? { ...(row.settingsJson as Record<string, unknown>) }
      : {};

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await prisma.phoneNumber.update({
    where: { id: input.numberId },
    data: {
      settingsJson: {
        ...settings,
        personalServiceState: "PORTING_OUT",
        portStatus: "porting_out",
        portAwayWindowExpiresAt: expiresAt,
        portOutGainingCarrier: input.gainingCarrier?.trim() || null,
        portOutGainingAccountNumber: input.gainingAccountNumber?.trim() || null,
      },
    },
  });

  const portRequest = await createPortOutRequest({
    workspaceId: input.workspaceId,
    userId: input.userId,
    phone: row.e164,
    phoneNumberId: input.numberId,
    provider: refreshed.provider,
    accountNumber: refreshed.accountNumber,
    accountPin: refreshed.pin,
    gainingCarrier: input.gainingCarrier,
    gainingAccountNumber: input.gainingAccountNumber,
    notes: input.notes,
  });

  const portAwaySettings =
    portAway.settingsJson && typeof portAway.settingsJson === "object"
      ? (portAway.settingsJson as Record<string, unknown>)
      : {};

  const portRequestRow = portRequest;

  return {
    accountNumber: refreshed.accountNumber,
    pin: refreshed.pin,
    provider: refreshed.provider,
    portRequestId: portRequestRow.id,
    portAwayExpiresAt:
      (portAwaySettings.portAwayWindowExpiresAt as string) || expiresAt,
  };
}
