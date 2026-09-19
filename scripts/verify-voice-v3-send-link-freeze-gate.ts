#!/usr/bin/env npx tsx
/**
 * Post-PSTN verification for SEND_LINK freeze (gates A–D on DB message row).
 * Gate C (no CRM) requires log inspection — script prints grep hint.
 */
import { getPrisma } from "../src/lib/db";

const CALL_CONTROL_ID = process.env.CALL_CONTROL_ID?.trim();
const MESSAGE_ID = process.env.MESSAGE_ID?.trim();
const EXPECTED_FROM = process.env.EXPECTED_FROM?.trim() || "+15717491060";
const EXPECTED_BOOKING_URL = process.env.EXPECTED_BOOKING_URL?.trim();

async function main() {
  const prisma = getPrisma();
  let msg: {
    id: string;
    from: string;
    to: string;
    body: string;
    status: string;
    providerStatus: string | null;
    providerId: string | null;
    trackingToken: string | null;
    destinationUrl: string | null;
    idempotencyKey: string | null;
    createdAt: Date;
  } | null = null;

  if (MESSAGE_ID) {
    msg = await prisma.message.findFirst({ where: { id: MESSAGE_ID } });
  } else if (CALL_CONTROL_ID) {
    msg = await prisma.message.findFirst({
      where: { idempotencyKey: { startsWith: `v3_send_link:${CALL_CONTROL_ID}:` } },
      orderBy: { createdAt: "desc" },
    });
  } else {
    throw new Error("Set CALL_CONTROL_ID or MESSAGE_ID");
  }

  if (!msg) {
    console.error("FREEZE_GATE FAIL no Message row found");
    process.exit(1);
  }

  const results: { gate: string; pass: boolean; detail: string }[] = [];

  const fromOk = msg.from.replace(/\s/g, "") === EXPECTED_FROM.replace(/\s/g, "");
  results.push({
    gate: "A_FROM",
    pass: fromOk,
    detail: `from=${msg.from} expected=${EXPECTED_FROM}`,
  });

  const url = EXPECTED_BOOKING_URL || "";
  const hasBookingUrl = url ? msg.body.includes(url) : !msg.body.includes("/r/");
  const noTracking = !msg.body.includes("/r/") && !msg.trackingToken;
  results.push({
    gate: "B_URL",
    pass: hasBookingUrl && noTracking,
    detail: `hasBookingUrl=${hasBookingUrl} noTracking=${noTracking} trackingToken=${msg.trackingToken ?? "null"}`,
  });

  results.push({
    gate: "C_CRM",
    pass: false,
    detail: `MANUAL: web logs must not show bullmq crm-* sms.sent-sms-${msg.id} (see docs/VOICE-V3-SEND-LINK-FREEZE-GATE.md)`,
  });

  const delivered =
    msg.status === "delivered" ||
    msg.providerStatus === "delivered" ||
    msg.status === "sent";
  results.push({
    gate: "D_DELIVERED",
    pass: delivered,
    detail: `status=${msg.status} providerStatus=${msg.providerStatus} providerId=${msg.providerId}`,
  });

  const consent = CALL_CONTROL_ID
    ? await prisma.smartRoutingSmsConsentEvent.findFirst({
        where: { callSessionId: CALL_CONTROL_ID, consentScope: "VOICE_BOOKING_LINK" },
      })
    : null;

  console.log("SEND_LINK_FREEZE_GATE", {
    messageId: msg.id,
    callControlId: CALL_CONTROL_ID ?? null,
    createdAt: msg.createdAt.toISOString(),
    consentRecorded: Boolean(consent),
  });

  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"} ${r.gate} ${r.detail}`);
  }

  const autoPass = results.filter((r) => r.gate !== "C_CRM").every((r) => r.pass);
  if (!autoPass) process.exit(1);
  console.log("AUTO_GATES_A_B_D_PASS — complete gate C via SSH log grep before freezing");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
