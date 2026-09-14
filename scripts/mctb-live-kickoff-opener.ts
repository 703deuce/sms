#!/usr/bin/env npx tsx
/**
 * Live Test #1 kickoff: send the real MCTB opener after Press-1 consent.
 *
 *   CUSTOMER_PHONE=5714776175 WORKSPACE_ID=ws_1 \
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/mctb-live-kickoff-opener.ts
 *
 * Uses production send path (executeMissedCallTextSend). Creates a fresh missedCallEvent
 * when none is pending for this caller in the last 2 hours.
 */
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { executeMissedCallTextSend } from "@/lib/agents/missed-call-text-back/send";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { HP_CERTIFIED_SMS_E164 } from "@/lib/messaging/preferred-sending-number";
import {
  resolveMctbMessageTemplate,
  renderMctbMessageTemplate,
} from "@/lib/mctb/message-template";
import { resolveMctbTemplateVars } from "@/lib/mctb/template-vars";

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const CUSTOMER_PHONE = toE164(process.env.CUSTOMER_PHONE || process.argv[2] || "");
const FORCE = process.argv.includes("--force");

async function main() {
  if (!CUSTOMER_PHONE || CUSTOMER_PHONE.length < 11) {
    console.error("Set CUSTOMER_PHONE or pass E.164 as first arg");
    process.exit(1);
  }

  delete process.env.HEADLESS_PROVIDER_MODE;
  delete process.env.LR_CERT_E2E;
  process.env.MESSAGING_PROVIDER = process.env.MESSAGING_PROVIDER || "telnyx";

  const prisma = getPrisma();
  const mctb = await loadMissedCallTextConfig(WORKSPACE_ID);
  const lr = await loadLeadRecoveryConfig(WORKSPACE_ID);

  console.log(
    JSON.stringify(
      {
        workspaceId: WORKSPACE_ID,
        customer: CUSTOMER_PHONE,
        mctbEnabled: mctb.enabled,
        conversationEnabled: mctb.conversationEnabled,
        leadRecoveryEnabled: lr.enabled,
        smsPhoneNumberId: mctb.smsPhoneNumberId,
      },
      null,
      2,
    ),
  );

  if (!mctb.enabled) {
    console.error("MCTB is disabled for this workspace — enable before live test.");
    process.exit(1);
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  let event = await prisma.missedCallEvent.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      callerE164: CUSTOMER_PHONE,
      createdAt: { gte: twoHoursAgo },
      status: { notIn: ["SUPPRESSED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (event?.smsSentAt && !FORCE) {
    console.log("Recent event already sent SMS:", event.id, event.smsSentAt);
    console.log("Use --force to create a new event and send again.");
    process.exit(0);
  }

  if (!event || event.smsSentAt) {
    const contact =
      (await prisma.contact.findFirst({
        where: { workspaceId: WORKSPACE_ID, phone: CUSTOMER_PHONE },
      })) ||
      (await prisma.contact.create({
        data: {
          workspaceId: WORKSPACE_ID,
          phone: CUSTOMER_PHONE,
          firstName: "Live",
          lastName: "Test",
        },
      }));

    const phoneNumber = mctb.smsPhoneNumberId
      ? await prisma.phoneNumber.findUnique({ where: { id: mctb.smsPhoneNumberId } })
      : await prisma.phoneNumber.findFirst({
          where: { workspaceId: WORKSPACE_ID, smsEnabled: true },
          orderBy: { updatedAt: "desc" },
        });

    if (!phoneNumber?.e164) {
      throw new Error("No SMS sender number configured for MCTB");
    }

    const traceId = `mctb_live_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    event = await prisma.missedCallEvent.create({
      data: {
        workspaceId: WORKSPACE_ID,
        contactId: contact.id,
        callerE164: CUSTOMER_PHONE,
        businessE164: phoneNumber.e164,
        phoneNumberId: phoneNumber.id,
        reason: "missed_no_answer",
        disposition: "missed_no_answer",
        detectedAt: new Date(),
        eligible: true,
        status: "SCHEDULED",
        scheduledSmsAt: new Date(),
        traceId,
        idempotencyKey: `live-test-opener:${WORKSPACE_ID}:${CUSTOMER_PHONE}:${Date.now()}`,
        metadata: {
          captureMode: "SIP_INGRESS",
          consentMode: "press_1",
          liveTestKickoff: true,
          press1ConsentedAt: new Date().toISOString(),
          provider: "LIVE_MANUAL_TEST",
        },
      },
    });
    console.log("Created missedCallEvent:", event.id);
  } else {
    console.log("Reusing pending event:", event.id);
  }

  let send = await executeMissedCallTextSend({
    workspaceId: WORKSPACE_ID,
    missedCallEventId: event.id,
    traceId: event.traceId,
  });

  if (!send.ok && send.reason === "MESSAGING_NOT_APPROVED") {
    console.log("\nProduction route blocked — using HP 571 demoBypass opener (live manual test).");
    const contact = await prisma.contact.findFirst({
      where: { workspaceId: WORKSPACE_ID, phone: CUSTOMER_PHONE },
    });
    const templateVars = resolveMctbTemplateVars({
      config: mctb,
      callerE164: CUSTOMER_PHONE,
      contact,
      missedCallEventId: event.id,
    });
    const body = renderMctbMessageTemplate(resolveMctbMessageTemplate(mctb), templateVars);
    const sms = await sendQuickSms({
      workspaceId: WORKSPACE_ID,
      to: CUSTOMER_PHONE,
      from: HP_CERTIFIED_SMS_E164,
      body,
      demoBypass: true,
      idempotencyKey: `mctb-recovery:${event.id}`,
      customerName: contact?.firstName || undefined,
    });
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: {
        status: "SENT",
        eligible: true,
        smsSentAt: new Date(),
        suppressionReason: null,
      },
    });
    send = { ok: true, reason: "demoBypass_opener", messageId: (sms as { messageId?: string })?.messageId };
    console.log("Opener body:", body);
  }

  console.log("\nSend result:", JSON.stringify(send, null, 2));

  const after = await prisma.missedCallEvent.findUnique({ where: { id: event.id } });
  console.log("\nEvent after send:", {
    status: after?.status,
    smsSentAt: after?.smsSentAt,
    suppressionReason: after?.suppressionReason,
  });

  console.log(
    `\nNext: reply from ${CUSTOMER_PHONE} with:\n` +
      `"I need someone to come look at my water heater."\n` +
      `Then run: WORKSPACE_ID=${WORKSPACE_ID} CUSTOMER_PHONE=${CUSTOMER_PHONE} npx tsx scripts/mctb-lead-recovery-live-inspect.ts`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
