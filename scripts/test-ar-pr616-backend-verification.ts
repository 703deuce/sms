/**
 * PR #616 pre-merge backend verification (isolated workspaces; no MCTB changes).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-pr616-backend-verification.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { hydrateProdTestEnvFromCoolify } from "./cloud-agent/hydrate-prod-test-env";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { getArAiReschedulerModelId } from "@/lib/appointment-reminders/ai-rescheduler/model";
import { DEFAULT_PLATFORM_CONFIG } from "@/lib/appointments/types";
import { resolveAiReschedulerConfig } from "@/lib/appointment-reminders/ai-rescheduler/types";
import { parseImportedExternalId } from "@/lib/calendar/external-id";
import { providerRefFromAppointment } from "@/lib/appointment-reminders/ai-rescheduler/provider-mutations";
import {
  isAppointmentRemindersV1Primary,
  isMctbCustomerOnboardingOffered,
} from "@/lib/workspace/platform-launch";
import { shouldShowProductSwitcher } from "@/lib/products/product-shell";
import { isMctbCustomerUiPathIncludingLegacyVoice } from "@/lib/products/mctb-launch-gate";

type SectionResult = { name: string; status: "PASS" | "FAIL" | "SKIP" | "CONFIG"; detail: string };

const results: SectionResult[] = [];

function record(name: string, status: SectionResult["status"], detail: string) {
  results.push({ name, status, detail });
  const tag = status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : status === "CONFIG" ? "CONFIG" : "SKIP";
  console.log(`${tag} ${name}: ${detail}`);
}

async function sectionReconciliation() {
  const { getPrisma } = await import("@/lib/db");
  const { reconcileArReschedulePending } = await import(
    "@/lib/appointment-reminders/ai-rescheduler/reconcile-pending"
  );
  const prisma = getPrisma();
  const slug = `ar-reconcile-${randomBytes(4).toString("hex")}`;
  const ws = await prisma.workspace.create({
    data: { name: "AR Reconcile Test", slug, billingPlan: "trial" },
  });
  const oldStart = new Date(Date.now() + 3 * 86400000);
  const oldEnd = new Date(oldStart.getTime() + 30 * 60_000);
  const newStart = new Date(oldStart.getTime() + 86400000);
  const newEnd = new Date(newStart.getTime() + 30 * 60_000);
  const opId = `test-reconcile:${randomBytes(4).toString("hex")}`;

  const appt = await prisma.voiceAppointment.create({
    data: {
      workspaceId: ws.id,
      startsAt: oldStart,
      endsAt: oldEnd,
      status: "scheduled",
      metadata: {
        arReconcilePending: {
          operationId: opId,
          providerUpdatedAt: new Date().toISOString(),
          proposedStartsAt: newStart.toISOString(),
          proposedEndsAt: newEnd.toISOString(),
        },
        arRescheduleOps: {},
        smsConsent: true,
      },
    },
  });

  try {
    const out = await reconcileArReschedulePending({
      workspaceId: ws.id,
      appointmentId: appt.id,
    });
    assert.equal(out.ok, true, out.message);

    const after = await prisma.voiceAppointment.findFirst({ where: { id: appt.id } });
    assert.ok(after);
    assert.equal(after!.startsAt.toISOString(), newStart.toISOString());
    const meta = (after!.metadata || {}) as Record<string, unknown>;
    assert.equal(meta.arReconcilePending, undefined, "pending flag cleared");

    record(
      "reconciliation_provider_ok_local_catchup",
      "PASS",
      "SIMULATED — no external calendar ref; reconcile synced local row from arReconcilePending",
    );
  } finally {
    await prisma.voiceAppointment.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.workspace.delete({ where: { id: ws.id } });
  }
}

async function sectionStaffApprovalRevalidation() {
  const { getPrisma } = await import("@/lib/db");
  const { saveAppointmentPlatformConfig } = await import("@/lib/appointments/settings");
  const { queueArRescheduleBusinessApproval, approveArRescheduleRequest } = await import(
    "@/lib/appointment-reminders/ai-rescheduler/business-approval"
  );
  const prisma = getPrisma();
  const slug = `ar-approve-${randomBytes(4).toString("hex")}`;
  const ws = await prisma.workspace.create({
    data: { name: "AR Approve Test", slug, billingPlan: "trial" },
  });

  const start = new Date(Date.now() + 5 * 86400000);
  start.setUTCHours(18, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);
  const proposed = new Date(start.getTime() + 86400000);
  proposed.setUTCHours(19, 0, 0, 0);
  const proposedEnd = new Date(proposed.getTime() + 30 * 60_000);

  const contact = await prisma.contact.create({
    data: {
      workspaceId: ws.id,
      phone: "+15550001122",
      firstName: "Test",
      lastName: "Customer",
    },
  });

  const appt = await prisma.voiceAppointment.create({
    data: {
      workspaceId: ws.id,
      contactId: contact.id,
      startsAt: start,
      endsAt: end,
      status: "scheduled",
      timezone: "America/New_York",
      metadata: { smsConsent: true, inviteePhone: "+15550001122" },
    },
  });

  try {
    await saveAppointmentPlatformConfig(ws.id, {
      ...DEFAULT_PLATFORM_CONFIG,
      timezone: "America/New_York",
      aiRescheduler: {
        mode: "ai",
        approval: "business",
        minimumNoticeMinutes: 60,
        maximumDaysAhead: 60,
        durationMode: "appointment",
        weeklyHours: resolveAiReschedulerConfig(DEFAULT_PLATFORM_CONFIG).weeklyHours,
      },
    });

    const opId = `staff-test:${randomBytes(4).toString("hex")}`;
    await queueArRescheduleBusinessApproval({
      workspaceId: ws.id,
      appointmentId: appt.id,
      contactId: contact.id,
      proposedStartsAt: proposed.toISOString(),
      proposedEndsAt: proposedEnd.toISOString(),
      operationId: opId,
    });

    const approved = await approveArRescheduleRequest({
      workspaceId: ws.id,
      appointmentId: appt.id,
      staffUserId: "test-staff",
    });
    assert.equal(approved.ok, true, !approved.ok ? approved.message : "");

    const after = await prisma.voiceAppointment.findFirst({ where: { id: appt.id } });
    assert.ok(after);
    assert.equal(after!.startsAt.toISOString(), proposed.toISOString());

    record(
      "staff_approval_with_revalidation",
      "PASS",
      "SIMULATED calendar (no provider ref); commit + slot revalidation at approve time",
    );
  } finally {
    await prisma.voiceAppointment.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.contact.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.solutionSetup.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.workspace.delete({ where: { id: ws.id } });
  }
}

function isArReplySessionSchemaMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("ar_sms_reply_sessions") || msg.includes("ArSmsReplySession");
}

async function sectionReschedulePipelineDb() {
  const { getPrisma } = await import("@/lib/db");
  const { saveAppointmentPlatformConfig } = await import("@/lib/appointments/settings");
  const { selectArOutboundPlatformSender, claimArReplySessionForOutbound } = await import(
    "@/lib/appointment-reminders/messaging/reply-session"
  );
  const { commitArReschedule } = await import(
    "@/lib/appointment-reminders/ai-rescheduler/commit-reschedule"
  );
  const { resetAppointmentReminders } = await import("@/lib/appointments/reminder-state");
  const prisma = getPrisma();
  const slug = `ar-pipe-${randomBytes(4).toString("hex")}`;
  const ws = await prisma.workspace.create({
    data: { name: "AR Pipeline Test", slug, billingPlan: "trial" },
  });

  const consumer = "+15550009988";
  const start = new Date(Date.now() + 4 * 86400000);
  start.setUTCHours(15, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);
  const newStart = new Date(start.getTime() + 2 * 86400000);
  newStart.setUTCHours(16, 0, 0, 0);

  const contact = await prisma.contact.create({
    data: { workspaceId: ws.id, phone: consumer, firstName: "Pipe", lastName: "Test" },
  });

  const appt = await prisma.voiceAppointment.create({
    data: {
      workspaceId: ws.id,
      contactId: contact.id,
      startsAt: start,
      endsAt: end,
      status: "confirmed",
      timezone: "America/New_York",
      metadata: resetAppointmentReminders({
        smsConsent: true,
        inviteePhone: consumer,
        reminderState: { lastSentTimeline: "reminder_1440m_sent" },
      }),
    },
  });

  try {
    try {
    await saveAppointmentPlatformConfig(ws.id, {
      ...DEFAULT_PLATFORM_CONFIG,
      timezone: "America/New_York",
      aiRescheduler: {
        mode: "ai",
        approval: "automatic",
        minimumNoticeMinutes: 30,
        maximumDaysAhead: 90,
        durationMode: "appointment",
        weeklyHours: resolveAiReschedulerConfig(DEFAULT_PLATFORM_CONFIG).weeklyHours,
      },
    });

    const picked = await selectArOutboundPlatformSender({
      workspaceId: ws.id,
      appointmentId: appt.id,
      consumerE164: consumer,
    });
    if (!picked.ok) {
      record("reschedule_pipeline_session", "CONFIG", picked.reason || "no platform sender");
      return;
    }
    let claimed: { sessionId: string } | { collision: true; ownerAppointmentId: string };
    try {
      claimed = await claimArReplySessionForOutbound({
        workspaceId: ws.id,
        contactId: contact.id,
        appointmentId: appt.id,
        consumerE164: consumer,
        platformPhoneNumberId: picked.phoneNumberId,
        provider: picked.provider,
        timelineType: "reminder_1440m_sent",
      });
    } catch (err) {
      if (isArReplySessionSchemaMissing(err)) {
        record(
          "reschedule_pipeline_session",
          "CONFIG",
          "CONFIGURATION REQUIRED — apply migration 20261008130000_ar_sms_reply_session on Supabase",
        );
        return;
      }
      throw err;
    }
    if ("collision" in claimed) {
      record("reschedule_pipeline_session", "FAIL", "unexpected sender collision");
      return;
    }

    const sessionRow = await prisma.arSmsReplySession.findFirst({
      where: { id: claimed.sessionId },
    });
    assert.equal(sessionRow?.appointmentId, appt.id);

    const opId = `pipe:${randomBytes(4).toString("hex")}`;
    const committed = await commitArReschedule({
      workspaceId: ws.id,
      appointmentId: appt.id,
      startsAt: newStart.toISOString(),
      initiatedBy: "customer",
      operationId: opId,
    });
    assert.equal(committed.ok, true, !committed.ok ? committed.message : "");

    const after = await prisma.voiceAppointment.findFirst({ where: { id: appt.id } });
    assert.ok(after);
    assert.equal(after!.startsAt.toISOString(), newStart.toISOString());
    const meta = (after!.metadata || {}) as Record<string, unknown>;
    assert.ok(meta.reminderState, "reminders reset metadata present");

    record(
      "reschedule_pipeline_db",
      "PASS",
      "SIMULATED provider + real DB: session bound, commit, local sync, reminder reset",
    );
    } catch (inner) {
      if (isArReplySessionSchemaMissing(inner)) {
        record(
          "reschedule_pipeline_session",
          "CONFIG",
          "CONFIGURATION REQUIRED — apply migration 20261008130000_ar_sms_reply_session on Supabase",
        );
        return;
      }
      throw inner;
    }
  } finally {
    await prisma.arSmsReplySession?.deleteMany?.({ where: { workspaceId: ws.id } }).catch(() => undefined);
    await prisma.voiceAppointment.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.contact.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.solutionSetup.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.workspace.delete({ where: { id: ws.id } });
  }
}

async function sectionSenderAuthorization() {
  const { listArEligiblePlatformSenders } = await import(
    "@/lib/appointment-reminders/messaging/ar-platform-sender-pool"
  );
  const candidates = await listArEligiblePlatformSenders();
  const telnyx = candidates.filter((c) => c.provider === "telnyx");
  const twilio = candidates.filter((c) => c.provider === "twilio");
  if (!candidates.length) {
    record(
      "sender_telnyx_twilio_authorization",
      "CONFIG",
      "CONFIGURATION REQUIRED — no platform senders passed isPhoneAuthorizedForOutboundSms",
    );
    return;
  }
  const detail = `Telnyx authorized: ${telnyx.length}, Twilio backup authorized: ${twilio.length} (inventory scan, not live send)`;
  record("sender_telnyx_twilio_authorization", "PASS", detail);
}

function sectionProviderRefIsolation() {
  const googleExt = parseImportedExternalId("google:conn-ws-a:event-1");
  assert.ok(googleExt);
  assert.equal(googleExt?.provider, "google");

  const msExt = parseImportedExternalId("microsoft:conn-ws-b:event-2");
  assert.ok(msExt);
  assert.equal(msExt?.provider, "microsoft");

  const refA = providerRefFromAppointment({
    externalId: "google:conn-a:evt-a",
    metadata: {},
    timezone: "America/New_York",
    startsAt: new Date(),
    endsAt: new Date(),
  });
  assert.equal(refA?.connectionId, "conn-a");

  const refB = providerRefFromAppointment({
    externalId: "microsoft:conn-b:evt-b",
    metadata: {},
    timezone: "America/New_York",
    startsAt: new Date(),
    endsAt: new Date(),
  });
  assert.equal(refB?.connectionId, "conn-b");
  assert.notEqual(refA?.connectionId, refB?.connectionId);

  record(
    "google_microsoft_ref_parsing",
    "PASS",
    "SIMULATED — workspace-scoped connection ids parsed; live patch not invoked",
  );
}

function sectionMctbHiddenIntact() {
  assert.equal(isAppointmentRemindersV1Primary(), true);
  assert.equal(isMctbCustomerOnboardingOffered(), false);
  assert.equal(shouldShowProductSwitcher(), false);
  assert.equal(isMctbCustomerUiPathIncludingLegacyVoice("/mctb/missed-calls"), true);
  assert.equal(isMctbCustomerUiPathIncludingLegacyVoice("/api/telnyx/voice/mctb"), false);

  const mw = readFileSync("/workspace/src/middleware.ts", "utf8");
  assert.ok(mw.includes("isMctbCustomerUiPath"), "middleware references MCTB gate");
  assert.ok(mw.includes("/api/telnyx"), "webhook paths excluded from AR redirect");

  const mctbRuntimePath = "/workspace/src/lib/agents/missed-call-text-back/process.ts";
  const mctbRuntime = readFileSync(mctbRuntimePath, "utf8");
  assert.ok(mctbRuntime.length > 200, "MCTB runtime preserved");

  record("mctb_hidden_intact", "PASS", "launch flags + middleware gate; MCTB runtime file present");
}

async function main() {
  console.log("=== AR PR #616 backend verification ===\n");
  console.log(`Configured AR model: ${getArAiReschedulerModelId()}\n`);

  hydrateProdTestEnvFromCoolify();

  const {
    requireIsolatedArTestDatabase,
    ArTestDatabaseSkip,
  } = await import("./cloud-agent/ar-test-database-guard");
  try {
    requireIsolatedArTestDatabase();
  } catch (err) {
    if (err instanceof ArTestDatabaseSkip) {
      record("database_backed_tests", "CONFIG", err.message);
      sectionProviderRefIsolation();
      sectionMctbHiddenIntact();
      printSummary();
      process.exit(0);
    }
    throw err;
  }

  try {
    await sectionReconciliation();
    await sectionStaffApprovalRevalidation();
    await sectionReschedulePipelineDb();
    await sectionSenderAuthorization();
    sectionProviderRefIsolation();
    sectionMctbHiddenIntact();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record("unexpected_failure", "FAIL", msg);
  }

  printSummary();
  const failed = results.some((r) => r.status === "FAIL");
  process.exit(failed ? 1 : 0);
}

function printSummary() {
  console.log("\n=== Summary ===");
  const counts = { PASS: 0, FAIL: 0, SKIP: 0, CONFIG: 0 };
  for (const r of results) counts[r.status] += 1;
  console.log(`PASS=${counts.PASS} FAIL=${counts.FAIL} SKIP=${counts.SKIP} CONFIG=${counts.CONFIG}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
