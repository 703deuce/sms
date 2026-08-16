/**
 * Import Twilio incoming phone numbers into a workspace (subaccount + optional parent account).
 * Configures voice/SMS webhooks for Personal inbound routing.
 */

import { getPrisma } from "@/lib/db";
import { twilioAdapter } from "@/lib/messaging/twilio-adapter";
import { encryptSecret } from "@/lib/messaging/crypto";
import { getRegistrationByWorkspace, ensureRegistrationRow } from "@/lib/messaging/store";
import type { MessagingRegistration } from "@/lib/domain";
import { getLiveParentClient } from "@/lib/messaging/twilio-client";
import {
  assertLiveTwilioConfigured,
  getAppBaseUrl,
  getWebhookUrls,
} from "@/lib/messaging/twilio-config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { twilioNumberProvider } from "@/lib/numbers/providers/twilio-number-provider";
import { isTollFreeAreaCode } from "@/lib/premium-numbers/toll-free";

export type TwilioOwnedNumber = {
  sid: string;
  e164: string;
  accountSid: string;
  friendlyName?: string;
  source: "parent" | "subaccount";
};

async function ensureWorkspaceSubaccount(workspaceId: string): Promise<MessagingRegistration> {
  await ensureRegistrationRow(workspaceId);
  let reg = (await getRegistrationByWorkspace(workspaceId)) as MessagingRegistration;
  if (!reg.subaccountSid || !reg.subaccountAuthTokenEnc) {
    const sub = await twilioAdapter.createCustomerSubaccount(`Transovo ${workspaceId}`);
    const prisma = getPrisma();
    reg = (await prisma.messagingRegistration.update({
      where: { workspaceId },
      data: {
        subaccountSid: sub.sid,
        subaccountAuthTokenEnc: encryptSecret(sub.authToken),
      },
    })) as MessagingRegistration;
  }
  return reg;
}

export async function listTwilioOwnedNumbers(workspaceId: string): Promise<TwilioOwnedNumber[]> {
  assertLiveTwilioConfigured();
  const reg = await ensureWorkspaceSubaccount(workspaceId);
  const parent = getLiveParentClient();
  const out: TwilioOwnedNumber[] = [];
  const seen = new Set<string>();

  const parentRows = await parent.incomingPhoneNumbers.list({ limit: 50 });
  for (const row of parentRows) {
    const e164 = normalizeE164(row.phoneNumber);
    if (!e164 || seen.has(e164)) continue;
    seen.add(e164);
    out.push({
      sid: row.sid,
      e164,
      accountSid: row.accountSid,
      friendlyName: row.friendlyName,
      source: "parent",
    });
  }

  if (reg.subaccountSid) {
    const { getSubaccountTwilioClient } = await import("@/lib/messaging/twilio-client");
    const { decryptSecret } = await import("@/lib/messaging/crypto");
    const subClient = getSubaccountTwilioClient(
      reg.subaccountSid,
      decryptSecret(reg.subaccountAuthTokenEnc!),
    );
    const subRows = await subClient.incomingPhoneNumbers.list({ limit: 50 });
    for (const row of subRows) {
      const e164 = normalizeE164(row.phoneNumber);
      if (!e164 || seen.has(e164)) continue;
      seen.add(e164);
      out.push({
        sid: row.sid,
        e164,
        accountSid: row.accountSid,
        friendlyName: row.friendlyName,
        source: "subaccount",
      });
    }
  }

  return out;
}

async function transferToSubaccountIfNeeded(
  owned: TwilioOwnedNumber,
  subaccountSid: string,
): Promise<TwilioOwnedNumber> {
  if (owned.accountSid === subaccountSid) return owned;
  const parent = getLiveParentClient();
  await parent.incomingPhoneNumbers(owned.sid).update({ accountSid: subaccountSid });
  return { ...owned, accountSid: subaccountSid, source: "subaccount" };
}

async function configureTwilioWebhooks(sid: string, workspaceId: string): Promise<void> {
  await twilioNumberProvider.configureVoiceWebhook(sid, workspaceId);
}

export async function importTwilioNumbersIntoWorkspace(input: {
  workspaceId: string;
  userId?: string;
  e164s?: string[];
  transferFromParent?: boolean;
}) {
  const reg = await ensureWorkspaceSubaccount(input.workspaceId);
  if (!reg.subaccountSid) {
    throw new Error("Twilio subaccount could not be provisioned for this workspace");
  }

  const owned = await listTwilioOwnedNumbers(input.workspaceId);
  const want = input.e164s?.length
    ? new Set(input.e164s.map((n) => normalizeE164(n)).filter(Boolean))
    : null;
  const candidates = owned.filter((n) => (want ? want.has(n.e164) : true));

  const prisma = getPrisma();
  const imported: Array<{
    id: string;
    e164: string;
    twilioSid: string;
    source: string;
    webhooksConfigured: boolean;
    skippedReason?: string;
  }> = [];

  for (const n of candidates) {
    if (!n.sid) continue;

    const elsewhere = await prisma.phoneNumber.findFirst({
      where: { e164: n.e164, NOT: { workspaceId: input.workspaceId } },
      select: { id: true, workspaceId: true },
    });
    if (elsewhere) {
      imported.push({
        id: elsewhere.id,
        e164: n.e164,
        twilioSid: n.sid,
        source: n.source,
        webhooksConfigured: false,
        skippedReason: `already in workspace ${elsewhere.workspaceId}`,
      });
      continue;
    }

    let active = n;
    if (input.transferFromParent !== false && n.source === "parent") {
      try {
        active = await transferToSubaccountIfNeeded(n, reg.subaccountSid);
      } catch (err) {
        imported.push({
          id: "",
          e164: n.e164,
          twilioSid: n.sid,
          source: n.source,
          webhooksConfigured: false,
          skippedReason: `subaccount transfer failed: ${
            err instanceof Error ? err.message : String(err)
          }`.slice(0, 200),
        });
        continue;
      }
    }

    const digits = active.e164.replace(/\D/g, "");
    const npa = digits.slice(1, 4);
    const isTollFree = isTollFreeAreaCode(npa);

    const row = await prisma.phoneNumber.upsert({
      where: {
        workspaceId_e164: { workspaceId: input.workspaceId, e164: active.e164 },
      },
      create: {
        workspaceId: input.workspaceId,
        e164: active.e164,
        type: isTollFree ? "TollFree" : "Local",
        areaCode: npa || null,
        provider: "twilio",
        twilioSid: active.sid,
        providerNumberId: active.sid,
        status: "Active",
        purchasedAt: new Date(),
        a2pStatus: "PENDING",
        capabilitiesJson: { voice: true, sms: true, source: "twilio_sync" },
        settingsJson: {
          personalParked: false,
          parked: false,
        },
      },
      update: {
        provider: "twilio",
        twilioSid: active.sid,
        providerNumberId: active.sid,
        status: "Active",
        releasedAt: null,
        type: isTollFree ? "TollFree" : "Local",
        areaCode: npa || null,
      },
    });

    if (input.userId) {
      await prisma.phoneNumberAssignment.upsert({
        where: {
          phoneNumberId_userId: { phoneNumberId: row.id, userId: input.userId },
        },
        create: { phoneNumberId: row.id, userId: input.userId },
        update: {},
      });
    }

    let webhooksConfigured = false;
    try {
      await configureTwilioWebhooks(active.sid, input.workspaceId);
      webhooksConfigured = true;
    } catch (err) {
      imported.push({
        id: row.id,
        e164: active.e164,
        twilioSid: active.sid,
        source: active.source,
        webhooksConfigured: false,
        skippedReason: `webhook configure failed: ${
          err instanceof Error ? err.message : String(err)
        }`.slice(0, 200),
      });
      continue;
    }

    try {
      const { ensureNumberVoicemailBox } = await import("@/lib/phone/voicemail-service");
      if (input.userId) {
        await ensureNumberVoicemailBox(input.workspaceId, row.id, input.userId);
      }
    } catch {
      // non-fatal
    }

    imported.push({
      id: row.id,
      e164: active.e164,
      twilioSid: active.sid,
      source: active.source,
      webhooksConfigured,
    });
  }

  return {
    twilioCount: owned.length,
    subaccountSid: reg.subaccountSid,
    imported,
    voiceWebhookUrl: `${getAppBaseUrl()}/api/webhooks/twilio/voice`,
    smsWebhookUrl: getWebhookUrls().inbound,
  };
}
