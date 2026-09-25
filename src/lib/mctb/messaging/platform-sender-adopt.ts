import "server-only";

import { getPrisma } from "@/lib/db";
import { assertLiveTwilioConfigured } from "@/lib/messaging/twilio-config";
import { getLiveParentClient } from "@/lib/messaging/twilio-client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  isPlatformMctbSenderPhoneRecord,
  isPreservedTwilioPlatformMctbSenderRecord,
  parseMctbPhoneRole,
  platformMctbSenderSettings,
} from "@/lib/messaging/compliance/phone-number-class";
import { listTelnyxOwnedNumbers } from "@/lib/voice/telnyx/number-import";
import { isTfvApproved, parseMessagingComplianceFromSettings } from "@/lib/messaging/compliance/messaging-compliance";
import { isTollFreeAreaCode } from "@/lib/premium-numbers/toll-free";

export type AdoptMctbPlatformSenderResult = {
  phoneNumberId: string;
  e164: string;
  workspaceId: string;
  twilioSid: string;
  action: "created" | "updated" | "already_configured";
};

export type AdoptMctbTelnyxPlatformSenderResult = {
  phoneNumberId: string;
  e164: string;
  workspaceId: string;
  telnyxProviderNumberId: string;
  messagingProfileId: string | null;
  action: "created" | "updated" | "already_configured";
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function mergePlatformMctbSenderSettings(
  existingSettings: unknown,
  platformPatch: Record<string, unknown>,
): Record<string, unknown> {
  const existing = asRecord(existingSettings);
  const voiceIngressRole = parseMctbPhoneRole(existingSettings);
  const dualVoiceIngress =
    voiceIngressRole === "customer_mctb" || voiceIngressRole === "platform_demo";
  const patchCompliance = asRecord(platformPatch.messagingCompliance);
  const patchComplianceApproved =
    Boolean(patchCompliance.type) &&
    isTfvApproved(String(patchCompliance.status || "NOT_STARTED") as import("@/lib/messaging/compliance/messaging-compliance").TollFreeVerificationStatus);
  const merged = {
    ...existing,
    ...platformPatch,
    messagingCompliance: patchComplianceApproved
      ? platformPatch.messagingCompliance
      : (platformPatch.messagingCompliance ?? existing.messagingCompliance),
  };
  const telephony = asRecord(existing.telephony);
  const hasMctbTexmlIngress =
    telephony.routingMode === "mctb_texml" ||
    telephony.routingOwner === "mctb_texml" ||
    Boolean(asRecord(existing.mctbInbound).routingToken);

  if (dualVoiceIngress || hasMctbTexmlIngress) {
    merged.mctbRole = voiceIngressRole === "platform_demo" ? "platform_demo" : "customer_mctb";
    merged.platformMctbSender = true;
  }
  delete merged.platformMctbSenderPreservedTwilio;
  return merged;
}

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

/**
 * Register a Telnyx-owned number as the canonical MCTB platform SMS sender.
 * Preserves voice ingress role when the same DID is already `customer_mctb`.
 */
export async function adoptMctbPlatformSenderFromTelnyxAccount(input: {
  ownerWorkspaceId: string;
  e164: string;
}): Promise<AdoptMctbTelnyxPlatformSenderResult> {
  const e164 = normalizeE164(input.e164);
  const prisma = getPrisma();
  const owned = await listTelnyxOwnedNumbers();
  const telnyxRow = owned.find((n) => n.e164 === e164);
  if (!telnyxRow?.id) {
    throw new Error(`Telnyx account does not list phone number ${e164}`);
  }

  const existingRows = await prisma.phoneNumber.findMany({
    where: { e164, status: "Active" },
    select: { id: true, workspaceId: true, settingsJson: true, providerNumberId: true },
  });
  const configured = existingRows.find((row) =>
    isPlatformMctbSenderPhoneRecord({ settingsJson: row.settingsJson }),
  );
  const existingWsRowEarly = existingRows.find((r) => r.workspaceId === input.ownerWorkspaceId);
  const needsDualRoleRepair = (settings: unknown): boolean => {
    const telephony = asRecord(asRecord(settings).telephony);
    const hasIngress =
      telephony.routingMode === "mctb_texml" ||
      telephony.routingOwner === "mctb_texml" ||
      Boolean(asRecord(asRecord(settings).mctbInbound).routingToken);
    return hasIngress && parseMctbPhoneRole(settings) === "platform_mctb_sender";
  };

  if (
    configured &&
    configured.workspaceId === input.ownerWorkspaceId &&
    configured.providerNumberId === telnyxRow.id &&
    !needsDualRoleRepair(existingWsRowEarly?.settingsJson)
  ) {
    return {
      phoneNumberId: configured.id,
      e164,
      workspaceId: input.ownerWorkspaceId,
      telnyxProviderNumberId: telnyxRow.id,
      messagingProfileId: telnyxRow.messagingProfileId,
      action: "already_configured",
    };
  }

  const existingWsRow = existingRows.find((r) => r.workspaceId === input.ownerWorkspaceId);
  const platformPatch = platformMctbSenderSettings({
    provider: "telnyx",
    tfvApproved: true,
    dualVoiceIngress: Boolean(
      existingWsRow && parseMctbPhoneRole(existingWsRow.settingsJson) === "customer_mctb",
    ),
  });
  const settingsJson = mergePlatformMctbSenderSettings(
    existingWsRow?.settingsJson,
    platformPatch,
  );

  const digits = e164.replace(/\D/g, "");
  const npa = digits.slice(1, 4);
  const isTollFree = isTollFreeAreaCode(npa);

  const row = await prisma.phoneNumber.upsert({
    where: {
      workspaceId_e164: { workspaceId: input.ownerWorkspaceId, e164 },
    },
    create: {
      workspaceId: input.ownerWorkspaceId,
      e164,
      provider: "telnyx",
      providerNumberId: telnyxRow.id,
      type: isTollFree ? "TollFree" : "local",
      status: "Active",
      a2pStatus: "APPROVED",
      messagingService: telnyxRow.messagingProfileId,
      settingsJson,
    },
    update: {
      provider: "telnyx",
      providerNumberId: telnyxRow.id,
      status: "Active",
      a2pStatus: "APPROVED",
      messagingService: telnyxRow.messagingProfileId,
      settingsJson,
    },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      providerNumberId: true,
      messagingService: true,
      settingsJson: true,
    },
  });

  if (!isPlatformMctbSenderPhoneRecord({ settingsJson: row.settingsJson })) {
    throw new Error("Failed to persist Telnyx platform sender marker");
  }

  const action =
    configured && configured.id === row.id
      ? "already_configured"
      : existingWsRow
        ? "updated"
        : "created";

  return {
    phoneNumberId: row.id,
    e164: row.e164!,
    workspaceId: row.workspaceId,
    telnyxProviderNumberId: row.providerNumberId || telnyxRow.id,
    messagingProfileId: row.messagingService,
    action: action === "already_configured" ? "already_configured" : action,
  };
}

/**
 * Remove canonical platform-sender role from the Twilio TFN while keeping TFV metadata for reactivation.
 */
export async function demoteTwilioPlatformMctbSenderToPreserved(input: {
  ownerWorkspaceId: string;
  e164: string;
}): Promise<{ phoneNumberId: string; e164: string; action: "demoted" | "already_preserved" }> {
  const e164 = normalizeE164(input.e164);
  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { workspaceId: input.ownerWorkspaceId, e164, status: "Active" },
    select: { id: true, e164: true, settingsJson: true, provider: true },
  });
  if (!row) {
    throw new Error(`No active PhoneNumber for preserved Twilio platform sender ${e164}`);
  }
  if (isPreservedTwilioPlatformMctbSenderRecord({ settingsJson: row.settingsJson })) {
    return { phoneNumberId: row.id, e164: row.e164!, action: "already_preserved" };
  }
  if (!isPlatformMctbSenderPhoneRecord({ settingsJson: row.settingsJson })) {
    throw new Error(`PhoneNumber ${row.id} is not an active platform_mctb_sender`);
  }

  const settings = asRecord(row.settingsJson);
  const nextSettings = {
    ...settings,
    mctbRole: "customer_production",
    platformMctbSender: false,
    platformMctbSenderPreservedTwilio: true,
  };

  await prisma.phoneNumber.update({
    where: { id: row.id },
    data: { settingsJson: nextSettings },
  });

  return { phoneNumberId: row.id, e164: row.e164!, action: "demoted" };
}
