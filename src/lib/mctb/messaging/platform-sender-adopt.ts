import "server-only";

import { getPrisma } from "@/lib/db";
import { assertLiveTwilioConfigured } from "@/lib/messaging/twilio-config";
import { getLiveParentClient } from "@/lib/messaging/twilio-client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  isPlatformMctbSenderPhoneRecord,
  platformMctbSenderSettings,
} from "@/lib/messaging/compliance/phone-number-class";
import { isTfvApproved, parseMessagingComplianceFromSettings } from "@/lib/messaging/compliance/messaging-compliance";
import { isTollFreeAreaCode } from "@/lib/premium-numbers/toll-free";

export type AdoptMctbPlatformSenderResult = {
  phoneNumberId: string;
  e164: string;
  workspaceId: string;
  twilioSid: string;
  action: "created" | "updated" | "already_configured";
};

/**
 * Import metadata for a parent-account Twilio TFN into Transovo without moving the number
 * to a workspace subaccount (Model B).
 */
export async function adoptMctbPlatformSenderFromParentAccount(input: {
  ownerWorkspaceId: string;
  e164: string;
}): Promise<AdoptMctbPlatformSenderResult> {
  assertLiveTwilioConfigured();
  const e164 = normalizeE164(input.e164);
  const prisma = getPrisma();

  const existingRole = await prisma.phoneNumber.findMany({
    where: { e164, status: "Active" },
    select: { id: true, workspaceId: true, settingsJson: true, twilioSid: true },
  });
  const configured = existingRole.find((row) =>
    isPlatformMctbSenderPhoneRecord({ settingsJson: row.settingsJson }),
  );
  if (configured && configured.workspaceId === input.ownerWorkspaceId) {
    return {
      phoneNumberId: configured.id,
      e164,
      workspaceId: input.ownerWorkspaceId,
      twilioSid: configured.twilioSid || "",
      action: "already_configured",
    };
  }

  const client = getLiveParentClient();
  const listed = await client.incomingPhoneNumbers.list({ phoneNumber: e164, limit: 5 });
  const twilioRow = listed.find((n) => normalizeE164(n.phoneNumber) === e164);
  if (!twilioRow?.sid) {
    throw new Error(`Twilio parent account does not list incoming number ${e164}`);
  }

  const digits = e164.replace(/\D/g, "");
  const npa = digits.slice(1, 4);
  const isTollFree = isTollFreeAreaCode(npa);
  const settings = platformMctbSenderSettings({ provider: "twilio", tfvApproved: true });
  const compliance = parseMessagingComplianceFromSettings(settings);
  if (!compliance || !isTfvApproved(compliance.status as string)) {
    throw new Error("Platform sender settings must include approved TFV state");
  }

  const row = await prisma.phoneNumber.upsert({
    where: {
      workspaceId_e164: { workspaceId: input.ownerWorkspaceId, e164 },
    },
    create: {
      workspaceId: input.ownerWorkspaceId,
      e164,
      provider: "twilio",
      providerNumberId: twilioRow.sid,
      twilioSid: twilioRow.sid,
      type: isTollFree ? "toll_free" : "local",
      status: "Active",
      settingsJson: settings,
    },
    update: {
      provider: "twilio",
      providerNumberId: twilioRow.sid,
      twilioSid: twilioRow.sid,
      status: "Active",
      settingsJson: settings,
    },
    select: { id: true, e164: true, workspaceId: true, twilioSid: true, settingsJson: true },
  });

  if (!isPlatformMctbSenderPhoneRecord({ settingsJson: row.settingsJson })) {
    throw new Error("Failed to persist platform_mctb_sender role");
  }

  const action =
    configured && configured.id === row.id
      ? "already_configured"
      : existingRole.some((r) => r.id === row.id)
        ? "updated"
        : "created";

  return {
    phoneNumberId: row.id,
    e164: row.e164!,
    workspaceId: row.workspaceId,
    twilioSid: row.twilioSid || twilioRow.sid,
    action: action === "already_configured" ? "already_configured" : action,
  };
}
