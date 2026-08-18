/**
 * Twilio port-out — subaccount credentials, webhook, and port-away lifecycle.
 *
 * Account number for port-away: owning customer **subaccount SID** (not parent).
 * Twilio docs: carriers often use last 8 characters of Account SID.
 * PIN: US local numbers require PIN — stored per-number until Twilio documents
 * a programmatic port-away PIN API (contact porting@twilio.com for disputes).
 */

import { randomInt } from "crypto";
import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { getLiveParentClient } from "@/lib/messaging/twilio-client";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { readPersonalCallSettings } from "./personal-call-settings";
import { transitionPortOutStatus } from "./port-out-service";

export type TwilioPortAwayAccountFormats = {
  /** Full subaccount SID — internal reference only. */
  subaccountSid: string;
  /** Primary value shown to customer / gaining carrier (full SID). */
  accountNumber: string;
  /** Last 8 chars — alternate format some carriers require. */
  accountNumberLast8: string;
  /** Last 8 digits only — when carrier rejects letters. */
  accountNumberLast8Digits: string;
};

export function formatTwilioPortAwayAccountNumber(subaccountSid: string): TwilioPortAwayAccountFormats {
  const sid = subaccountSid.trim();
  const last8 = sid.slice(-8);
  const last8Digits = last8.replace(/\D/g, "").slice(-8) || sid.replace(/\D/g, "").slice(-8);
  return {
    subaccountSid: sid,
    accountNumber: sid,
    accountNumberLast8: last8,
    accountNumberLast8Digits: last8Digits,
  };
}

function randomPortPin(): string {
  return String(randomInt(10000, 99999));
}

export async function ensureTwilioPortOutPin(
  workspaceId: string,
  numberId: string,
): Promise<string> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: numberId, workspaceId, provider: "twilio" },
  });
  if (!row) throw new Error("Twilio number not found");

  const callSettings = readPersonalCallSettings({
    settingsJson: row.settingsJson,
    voiceForwardTo: row.voiceForwardTo,
  });
  if (callSettings.portOutPin?.trim()) return callSettings.portOutPin.trim();

  const pin = randomPortPin();
  const settings =
    row.settingsJson && typeof row.settingsJson === "object"
      ? { ...(row.settingsJson as Record<string, unknown>) }
      : {};
  settings.portOutPin = pin;

  await prisma.phoneNumber.update({
    where: { id: numberId },
    data: { settingsJson: settings },
  });
  return pin;
}

export async function syncPersonalPortOutFromTwilio(
  workspaceId: string,
  numberId: string,
): Promise<{
  accountNumber: string | null;
  pin: string | null;
  twilioSynced: boolean;
  provider: "twilio";
  accountFormats?: TwilioPortAwayAccountFormats | null;
}> {
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: numberId, workspaceId },
  });
  if (!row) {
    return { accountNumber: null, pin: null, twilioSynced: false, provider: "twilio" };
  }

  const reg = await getRegistrationByWorkspace(workspaceId);
  const subaccountSid = reg?.subaccountSid?.trim() || null;

  if (!subaccountSid) {
    return {
      accountNumber: null,
      pin: null,
      twilioSynced: false,
      provider: "twilio",
    };
  }

  const formats = formatTwilioPortAwayAccountNumber(subaccountSid);
  const pin = await ensureTwilioPortOutPin(workspaceId, numberId);

  const settings =
    row.settingsJson && typeof row.settingsJson === "object"
      ? { ...(row.settingsJson as Record<string, unknown>) }
      : {};

  settings.portOutAccountNumber = formats.accountNumber;
  settings.portOutPin = pin;
  settings.portOutAccountFormats = formats;

  await prisma.phoneNumber.update({
    where: { id: numberId },
    data: { settingsJson: settings },
  });

  return {
    accountNumber: formats.accountNumber,
    pin,
    twilioSynced: true,
    provider: "twilio",
    accountFormats: formats,
  };
}

export async function ensureTwilioPortOutWebhookConfigured(): Promise<{ url: string } | null> {
  const base = getAppBaseUrl().replace(/\/$/, "");
  if (!base || base.includes("localhost")) {
    console.warn("[twilio-port-out] skip webhook configure — APP_URL not public");
    return null;
  }

  const portOutUrl = `${base}/api/webhooks/twilio/port-out`;
  const client = getLiveParentClient();

  try {
    await client.numbers.v1.portingWebhookConfigurations.create({
      portInTargetUrl: `${base}/api/webhooks/twilio/port-in-unused`,
      portOutTargetUrl: portOutUrl,
      notificationsOf: ["PortOutPhoneNumberCompleted"],
    });
  } catch (err) {
    console.warn("[twilio-port-out] webhook configure failed (may already exist)", err);
  }

  return { url: portOutUrl };
}

export async function matchPortOutRequestForTwilioPhone(input: {
  phone: string;
  eventName?: string | null;
}) {
  const prisma = getPrisma();
  const e164 = normalizeE164(input.phone);
  const pn = await prisma.phoneNumber.findFirst({
    where: { e164, provider: "twilio" },
  });
  if (!pn) return { matched: false as const, reason: "number_not_found" };

  const activeIntent = await prisma.portOutRequest.findFirst({
    where: {
      workspaceId: pn.workspaceId,
      phoneNumberId: pn.id,
      status: { notIn: ["COMPLETED", "CANCELED"] },
    },
    orderBy: { initiatedAt: "desc" },
  });

  if (!activeIntent) {
    return {
      matched: false as const,
      unexpected: true as const,
      workspaceId: pn.workspaceId,
      phoneNumberId: pn.id,
      phone: e164,
    };
  }

  return {
    matched: true as const,
    workspaceId: pn.workspaceId,
    phoneNumberId: pn.id,
    portOutId: activeIntent.id,
    phone: e164,
    eventName: input.eventName,
  };
}

function twilioVoiceMessagingStatus(payload: Record<string, unknown>) {
  const status = String(payload.status || "").toLowerCase();
  const portable = payload.portable;
  const voicePortStatus =
    status.includes("completed") || status === "ported"
      ? "completed"
      : status.includes("pending")
        ? "pending"
        : status || "pending";
  const messagingPortStatus =
    portable === false || portable === "false"
      ? "not_started"
      : status.includes("completed")
        ? "completed"
        : "not_started";
  return { voicePortStatus, messagingPortStatus };
}

export async function handleTwilioPortOutWebhook(payload: Record<string, unknown>) {
  const phone = String(
    payload.phone_number || payload.PhoneNumber || payload.phoneNumber || "",
  );
  const eventName = String(
    payload.event_type ||
      payload.EventType ||
      payload.status ||
      "PortOutPhoneNumberCompleted",
  );

  if (!phone) return { handled: false, reason: "missing_phone" };

  const match = await matchPortOutRequestForTwilioPhone({ phone, eventName });
  const { voicePortStatus, messagingPortStatus } = twilioVoiceMessagingStatus(payload);

  if (!match.matched) {
    if ("unexpected" in match && match.unexpected && match.workspaceId) {
      const prisma = getPrisma();
      const workspace = await prisma.workspace.findUnique({
        where: { id: match.workspaceId },
        select: { ownerUserId: true },
      });
      await prisma.portOutRequest.create({
        data: {
          workspaceId: match.workspaceId,
          userId: workspace?.ownerUserId || "system",
          phoneNumberId: match.phoneNumberId,
          phone: match.phone,
          provider: "twilio",
          status: "UNEXPECTED_PORT_REQUEST",
          statusHistoryJson: [
            {
              status: "UNEXPECTED_PORT_REQUEST",
              at: new Date().toISOString(),
              note: `Twilio port-out event without customer intent: ${eventName}`,
            },
          ],
          providerPayloadJson: payload,
        },
      });
    }
    return { handled: true, unexpected: true };
  }

  const isComplete =
    eventName === "PortOutPhoneNumberCompleted" ||
    String(payload.status || "").toLowerCase().includes("completed");

  if (isComplete) {
    await transitionPortOutStatus({
      workspaceId: match.workspaceId,
      portOutId: match.portOutId,
      status: "COMPLETED",
      note: `Twilio port-out completed (${eventName})`,
      voicePortStatus,
      messagingPortStatus,
      providerPayload: payload,
    });
    return { handled: true, portOutId: match.portOutId, status: "COMPLETED" };
  }

  await transitionPortOutStatus({
    workspaceId: match.workspaceId,
    portOutId: match.portOutId,
    status: "REQUEST_RECEIVED",
    note: `Twilio port-out event: ${eventName}`,
    voicePortStatus,
    messagingPortStatus,
    providerPayload: payload,
  });

  return { handled: true, portOutId: match.portOutId, status: "REQUEST_RECEIVED" };
}

/** Acceptance-test helper — returns customer packet fields without secrets leakage. */
export async function buildTwilioPortOutAcceptanceReport(
  workspaceId: string,
  phoneNumberId: string,
) {
  const synced = await syncPersonalPortOutFromTwilio(workspaceId, phoneNumberId);
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
  });
  const reg = await getRegistrationByWorkspace(workspaceId);

  return {
    e164: row?.e164,
    provider: "twilio",
    subaccountSidPresent: Boolean(reg?.subaccountSid),
    parentAccountExposed: false,
    accountNumberForCarrier: synced.accountNumber,
    accountNumberLast8: synced.accountFormats?.accountNumberLast8,
    accountNumberLast8Digits: synced.accountFormats?.accountNumberLast8Digits,
    pinPresent: Boolean(synced.pin),
    pinLength: synced.pin?.length ?? 0,
    acceptanceChecklist: [
      "Confirm gaining carrier accepts full subaccount SID OR last-8 per their form",
      "Confirm US local PIN matches value shown in Transovo port-out packet",
      "Confirm port-away webhook PortOutPhoneNumberCompleted hits /api/webhooks/twilio/port-out",
      "Verify number completes without exposing parent Twilio credentials",
    ],
  };
}
