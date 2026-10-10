/**
 * One real AR reminder via dispatch pipeline (no bulk SMS).
 *
 * Creates a due appointment on ws_1, runs discovery + dispatch executor once,
 * polls Telnyx delivery webhook reconciliation on the dispatch row.
 *
 *   npx tsx scripts/cloud-agent/hydrate-prod-test-env.ts
 *   WORKSPACE_ID=ws_1 PHONE=+1... NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-production-dispatch-reminder-smoke.ts
 */
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/db";
import { discoverAndEnqueueDueAppointmentReminders } from "@/lib/appointment-reminders/reminder-discovery";
import { executeArReminderDispatchJob } from "@/lib/appointment-reminders/reminder-dispatch-executor";
import { createId } from "@/lib/supabase/id";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const PHONE = process.env.PHONE?.trim() || process.env.AR_LIVE_CUSTOMER_E164?.trim() || "";
const CLEANUP = process.env.CLEANUP !== "0";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!PHONE) {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "PHONE or AR_LIVE_CUSTOMER_E164 not set" }));
    process.exit(0);
  }

  const prisma = getPrisma();
  const apptId = `ar-dispatch-smoke-${createId()}`;
  const minutesBefore = 1440;
  const startsAt = new Date(Date.now() + minutesBefore * 60_000 + 90_000);
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);

  await prisma.voiceAppointment.create({
    data: {
      id: apptId,
      workspaceId: WORKSPACE_ID,
      serviceName: `AR dispatch smoke ${new Date().toISOString()}`,
      startsAt,
      endsAt,
      timezone: "America/New_York",
      status: "scheduled",
      inviteePhone: PHONE,
      metadata: {
        inviteePhone: PHONE,
        reminderGeneration: 1,
        reminderSmsEligible: true,
        smsConsent: true,
        smsConsentAt: new Date().toISOString(),
        source: "ar_dispatch_smoke",
      },
    },
  });

  process.env.AR_REMINDER_DISCOVERY_TEST_WORKSPACE = WORKSPACE_ID;
  delete process.env.AR_REMINDER_DISCOVERY_TEST_SKIP_ENQUEUE;
  delete process.env.AR_REMINDER_DISPATCH_TEST_MOCK;

  let enqueued = 0;
  for (let i = 0; i < 8; i++) {
    const r = await discoverAndEnqueueDueAppointmentReminders();
    enqueued += r.enqueued;
    if (enqueued > 0) break;
    await sleep(500);
  }

  const dispatch = await prisma.arReminderDispatch.findFirst({
    where: { appointmentId: apptId },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(dispatch, "expected dispatch row after discovery");

  const first = await executeArReminderDispatchJob({ dispatchId: dispatch.id });
  const second = await executeArReminderDispatchJob({ dispatchId: dispatch.id });

  let finalRow = await prisma.arReminderDispatch.findUnique({ where: { id: dispatch.id } });
  for (let i = 0; i < 30 && finalRow && !["delivered", "sent", "accepted"].includes(finalRow.status); i++) {
    await sleep(2000);
    finalRow = await prisma.arReminderDispatch.findUnique({ where: { id: dispatch.id } });
  }

  const outcome = {
    status: first.ok ? "PASS" : "FAIL",
    enqueued,
    firstDispatch: first,
    duplicateDispatch: second,
    dispatchRow: finalRow
      ? {
          status: finalRow.status,
          telnyxMessageId: finalRow.telnyxMessageId,
          providerMessageId: finalRow.providerMessageId,
          lastError: finalRow.lastError,
        }
      : null,
    phoneDelivery: "MANUAL — confirm SMS on device",
  };

  console.log(JSON.stringify(outcome, null, 2));

  if (CLEANUP) {
    await prisma.arReminderDispatch.deleteMany({ where: { appointmentId: apptId } }).catch(() => undefined);
    await prisma.voiceAppointment.delete({ where: { id: apptId } }).catch(() => undefined);
  }

  if (!first.ok) process.exit(1);
  assert.ok(finalRow?.telnyxMessageId || finalRow?.providerMessageId, "expected provider message id persisted");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
