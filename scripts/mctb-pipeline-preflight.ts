#!/usr/bin/env npx tsx
/**
 * Static + DB checks for MCTB: missed call → opener SMS → customer reply → Lead Recovery.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' WORKSPACE_ID=ws_1 npx tsx scripts/mctb-pipeline-preflight.ts
 */
import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { evaluateMctbAiBookingReadiness } from "@/lib/mctb/ai-booking/readiness";
import { isMctbCustomerReplyThread } from "@/lib/agents/missed-call-text-back/customer-sms";
import { shouldSkipInboxAwayAutoReply } from "@/lib/mctb/messaging/skip-inbox-away";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const SAMPLE_CALLER = process.env.SAMPLE_CALLER_E164 || "";
const SAMPLE_DID = process.env.SAMPLE_MCTB_DID || "";

async function tableExists(table: string): Promise<boolean> {
  const prisma = getPrisma();
  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const prisma = getPrisma();
  const [mctbConfig, lr, readiness] = await Promise.all([
    loadMissedCallTextConfig(WORKSPACE_ID),
    loadLeadRecoveryConfig(WORKSPACE_ID),
    evaluateMctbAiBookingReadiness(WORKSPACE_ID),
  ]);

  const tables = [
    "missed_call_events",
    "mctb_handoff_configs",
    "mctb_ai_booking_sessions",
    "mctb_booking_links",
    "mctb_conversation_automation_states",
  ];
  const tableStatus: Record<string, boolean> = {};
  for (const t of tables) {
    tableStatus[t] = await tableExists(t);
  }

  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId: WORKSPACE_ID, status: "Active" },
    select: { e164: true, settingsJson: true },
  });

  let routing: Record<string, unknown> | null = null;
  if (SAMPLE_CALLER && SAMPLE_DID) {
    routing = {
      inReplyThread: await isMctbCustomerReplyThread(WORKSPACE_ID, SAMPLE_CALLER),
      skipInboxAway: await shouldSkipInboxAwayAutoReply({
        workspaceId: WORKSPACE_ID,
        fromE164: SAMPLE_CALLER,
        toE164: SAMPLE_DID,
      }),
    };
  }

  const lastEvent = await prisma.missedCallEvent.findFirst({
    where: { workspaceId: WORKSPACE_ID },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      callerE164: true,
      status: true,
      smsSentAt: true,
      suppressionReason: true,
    },
  });

  const report = {
    workspaceId: WORKSPACE_ID,
    mctb: {
      enabled: mctbConfig.enabled,
      conversationEnabled: mctbConfig.conversationEnabled,
      delaySeconds: mctbConfig.delaySeconds,
      smsPhoneNumberId: mctbConfig.smsPhoneNumberId || mctbConfig.phoneNumberId,
    },
    leadRecovery: {
      enabled: lr.enabled,
      policyHealth: lr.policyHealth,
      bookingScenario: lr.enabledScenarios?.booking,
    },
    aiBookingReadiness: readiness,
    tables: tableStatus,
    activePhones: phones.map((p) => p.e164),
    sampleRouting: routing,
    lastMissedCallEvent: lastEvent,
  };

  console.log(JSON.stringify(report, null, 2));

  const blockers: string[] = [];
  if (!mctbConfig.enabled) blockers.push("mctb_disabled");
  if (!lr.enabled || lr.policyHealth === "DISABLED") blockers.push("lead_recovery_not_ready");
  if (!tableStatus.missed_call_events) blockers.push("missing_missed_call_events_table");
  if (!readiness.ready && lr.enabledScenarios?.booking) {
    blockers.push(`ai_booking_not_ready:${readiness.reason}`);
  }

  if (blockers.length) {
    console.error("\nBLOCKERS:", blockers.join(", "));
    process.exit(1);
  }
  console.log("\nPreflight: no hard blockers detected.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
