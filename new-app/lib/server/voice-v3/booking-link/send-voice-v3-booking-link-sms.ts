import "server-only";

import { getPrisma } from "@/lib/server/db";
import { checkCreditBalance } from "@/lib/billing/entitlements";
import { assertWithinWorkspaceLimits } from "@/lib/settings/limits";
import { deductCreditsForSend } from "@/lib/settings/billing";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type VoiceV3BookingLinkSmsInput = {
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  toE164: string;
  fromE164: string;
  phoneNumberId: string;
  body: string;
  idempotencyKey: string;
};

export type VoiceV3BookingLinkSmsResult = {
  providerMessageId: string;
  status: string;
  messageId?: string;
  idempotentReplay?: boolean;
};

async function sendTelnyxSms(from: string, to: string, body: string): Promise<{ sid: string; status: string }> {
  const apiKey = process.env.TELNYX_API_KEY?.trim();
  if (!apiKey) throw new Error("TELNYX_API_KEY not configured");
  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, text: body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telnyx SMS failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { id?: string } };
  const sid = json.data?.id || `telnyx:${Date.now()}`;
  return { sid, status: "sent" };
}

export async function sendVoiceV3BookingLinkSms(
  input: VoiceV3BookingLinkSmsInput,
): Promise<VoiceV3BookingLinkSmsResult> {
  const workspaceId = input.workspaceId.trim();
  if (!workspaceId) throw new Error("workspaceId required");

  const to = normalizeE164(input.toE164);
  const from = normalizeE164(input.fromE164);
  if (!to || !from) throw new Error("VOICE_V3_BOOKING_LINK_SMS_INVALID_ROUTE");

  const entitlement = await checkCreditBalance(workspaceId);
  if (!entitlement.ok) throw new Error(entitlement.error);
  await assertWithinWorkspaceLimits(workspaceId);

  const prisma = getPrisma();
  if (input.idempotencyKey) {
    const prior = await prisma.message.findFirst({
      where: { workspaceId, idempotencyKey: input.idempotencyKey },
    });
    if (prior && prior.status !== "failed") {
      return {
        providerMessageId: prior.providerId || prior.id,
        status: prior.status,
        messageId: prior.id,
        idempotentReplay: true,
      };
    }
  }

  const body = input.body.trim();
  if (!body) throw new Error("SMS body is empty");

  const pending = await prisma.message.create({
    data: {
      workspaceId,
      to,
      from,
      body,
      status: "sending",
      providerId: input.idempotencyKey ? `idem:${input.idempotencyKey}` : `v3bl:${Date.now()}`,
      idempotencyKey: input.idempotencyKey || null,
    },
  });

  try {
    const result = await sendTelnyxSms(from, to, body);
    await prisma.message.update({
      where: { id: pending.id },
      data: { status: result.status, providerId: result.sid },
    });
    await deductCreditsForSend(workspaceId, 1, "Voice V3 booking link SMS").catch(() => undefined);
    return {
      providerMessageId: result.sid,
      status: result.status,
      messageId: pending.id,
    };
  } catch (err) {
    await prisma.message.update({ where: { id: pending.id }, data: { status: "failed" } }).catch(() => undefined);
    throw err;
  }
}
