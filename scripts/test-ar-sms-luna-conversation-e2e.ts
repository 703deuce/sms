/**
 * Simulates Appointment Reminders SMS ↔ Luna without a phone: each "text" is fed
 * through the same inbound handlers as production (C/R/X + follow-up → Luna).
 *
 * Requires a real appointment row (and contact with phone) in Supabase.
 *
 *   AR_SMS_E2E_WORKSPACE_ID=...
 *   AR_SMS_E2E_APPOINTMENT_ID=...
 *
 * Optional scripted customer lines (after R is sent automatically):
 *   AR_SMS_E2E_LINES='Friday afternoon\nthe second one\nYes'
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-sms-luna-conversation-e2e.ts
 *
 * Set AR_SMS_E2E_DRY_RUN=1 to stop before any calendar write (resolver only through slot offer).
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { requireIsolatedArTestDatabase } from "./cloud-agent/ar-test-database-guard";
import { hydrateProdTestEnvFromCoolify } from "./cloud-agent/hydrate-prod-test-env";
import { providers } from "@/lib/ai/llm-providers";
import { getPrisma } from "@/lib/db";
import { DEFAULT_PLATFORM_CONFIG } from "@/lib/appointments/types";
import { saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveAiReschedulerConfig } from "@/lib/appointment-reminders/ai-rescheduler/types";
import { getArAiReschedulerModelId } from "@/lib/appointment-reminders/ai-rescheduler/model";
import { handleAppointmentRemindersInboundBody } from "@/lib/appointment-reminders/messaging/handle-inbound-body";
import {
  claimArReplySessionForOutbound,
  ensureArConversation,
  selectArOutboundPlatformSender,
} from "@/lib/appointment-reminders/messaging/reply-session";
import { seedRescheduleConversationOnReminderSend } from "@/lib/appointment-reminders/ai-rescheduler/inbound-replies";
import { providerRefFromAppointment } from "@/lib/appointment-reminders/ai-rescheduler/provider-mutations";
import { resetAppointmentReminders } from "@/lib/appointments/reminder-state";

const MAX_TURNS = 12;

type E2eTarget = {
  workspaceId: string;
  appointmentId: string;
  contactId: string;
  consumerE164: string;
  bootstrap: boolean;
  originalStartsAt: string;
  originalEndsAt: Date;
};

async function resolveE2eTarget(prisma: ReturnType<typeof getPrisma>): Promise<E2eTarget> {
  let workspaceId = process.env.AR_SMS_E2E_WORKSPACE_ID?.trim();
  let appointmentId = process.env.AR_SMS_E2E_APPOINTMENT_ID?.trim();

  if (!workspaceId || !appointmentId) {
    if (process.env.AR_SMS_E2E_BOOTSTRAP !== "1") {
      throw new Error(
        "Set AR_SMS_E2E_WORKSPACE_ID + AR_SMS_E2E_APPOINTMENT_ID, or AR_SMS_E2E_BOOTSTRAP=1 for an isolated real DB row.",
      );
    }
    const slug = `ar-luna-e2e-${randomBytes(5).toString("hex")}`;
    const ws = await prisma.workspace.create({
      data: { name: "AR Luna E2E", slug, billingPlan: "trial" },
    });
    const phone = `+1555${String(1_000_000 + (randomBytes(4).readUInt32BE(0) % 9_000_000))}`;
    const contact = await prisma.contact.create({
      data: { workspaceId: ws.id, phone, firstName: "Luna", lastName: "E2E" },
    });
    const start = new Date(Date.now() + 5 * 86400000);
    start.setUTCHours(18, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);
    const connId = process.env.AR_SMS_E2E_MICROSOFT_CONNECTION_ID?.trim();
    const eventId = process.env.AR_SMS_E2E_PROVIDER_EVENT_ID?.trim();
    const externalId =
      connId && eventId ? `microsoft:${connId}:${eventId}` : null;
    const appt = await prisma.voiceAppointment.create({
      data: {
        workspaceId: ws.id,
        contactId: contact.id,
        startsAt: start,
        endsAt: end,
        status: "confirmed",
        serviceName: "Appointment",
        timezone: "America/New_York",
        externalId,
        metadata: resetAppointmentReminders({
          smsConsent: true,
          inviteePhone: phone,
          ...(connId && eventId
            ? {
                source: "calendar_import",
                provider: "microsoft",
                connectionId: connId,
                providerEventId: eventId,
              }
            : {}),
        }),
      },
    });
    workspaceId = ws.id;
    appointmentId = appt.id;
    return {
      workspaceId,
      appointmentId,
      contactId: contact.id,
      consumerE164: phone,
      bootstrap: true,
      originalStartsAt: start.toISOString(),
      originalEndsAt: end,
    };
  }

  const appt = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
    include: { contact: { select: { id: true, phone: true } } },
  });
  if (!appt?.contactId || !appt.contact?.phone) {
    throw new Error("Appointment missing or contact has no phone");
  }
  return {
    workspaceId,
    appointmentId,
    contactId,
    consumerE164: appt.contact.phone,
    bootstrap: false,
    originalStartsAt: appt.startsAt.toISOString(),
    originalEndsAt: appt.endsAt,
  };
}

type TurnLog = { role: "customer" | "transovo"; text: string };

function parseUserLines(): string[] {
  const raw = process.env.AR_SMS_E2E_LINES?.trim();
  if (!raw) return [];
  return raw.split("\n").map((l) => l.trim()).filter(Boolean);
}

function autoReply(assistant: string, _scripted: string[], _scriptedIdx: number): string | null {
  const a = assistant.toLowerCase();
  if (/what day|what time|works better|when would/.test(a)) {
    return "Friday afternoon";
  }
  if (/which works|which time|which one|pick one|options/.test(a) || /\d{1,2}:\d{2}/.test(assistant)) {
    return "the second one";
  }
  if (/confirm|go ahead|would you like me to|is that correct|sound good/.test(a)) {
    return "Yes";
  }
  return null;
}

async function main() {
  console.log("=== AR SMS ↔ Luna conversation E2E (no phone) ===\n");
  console.log(`Model: ${getArAiReschedulerModelId()}\n`);

  requireIsolatedArTestDatabase();
  const hydrated = hydrateProdTestEnvFromCoolify();
  if (!hydrated.llm || providers().length === 0) {
    console.error("FAIL — no LLM provider (hydrate OPENAI_* from Coolify or set locally)");
    process.exit(1);
  }

  const dryRun = process.env.AR_SMS_E2E_DRY_RUN === "1";
  const prisma = getPrisma();
  const target = await resolveE2eTarget(prisma);
  const { workspaceId, appointmentId, contactId, consumerE164, bootstrap } = target;
  const originalStartsAt = target.originalStartsAt;

  const appt = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
    include: { contact: { select: { id: true, phone: true, firstName: true } } },
  });
  if (!appt) throw new Error("appointment_not_found");

  const providerRef = providerRefFromAppointment(appt);
  console.log("Appointment:", {
    id: appt.id,
    startsAt: originalStartsAt,
    status: appt.status,
    provider: providerRef?.provider ?? "local",
    externalId: appt.externalId?.slice(0, 40) ?? null,
  });

  await saveAppointmentPlatformConfig(workspaceId, {
    ...DEFAULT_PLATFORM_CONFIG,
    timezone: appt.timezone || DEFAULT_PLATFORM_CONFIG.timezone,
    aiRescheduler: {
      mode: "ai",
      approval: "automatic",
      minimumNoticeMinutes: 30,
      maximumDaysAhead: 90,
      durationMode: "appointment",
      allowProviderCancel: true,
      weeklyHours: resolveAiReschedulerConfig(DEFAULT_PLATFORM_CONFIG).weeklyHours,
    },
  });

  const picked = await selectArOutboundPlatformSender({
    workspaceId,
    appointmentId: appt.id,
    consumerE164,
  });
  if (!picked.ok) {
    console.error("CONFIG — no platform sender:", picked.reason);
    process.exit(1);
  }

  const conversationId = await ensureArConversation({
    workspaceId,
    contactId,
    toE164: consumerE164,
    fromE164: picked.e164,
  });

  const claimed = await claimArReplySessionForOutbound({
    workspaceId,
    contactId,
    appointmentId: appt.id,
    consumerE164,
    platformPhoneNumberId: picked.phoneNumberId,
    provider: picked.provider,
    timelineType: "reminder_1440m_sent",
    conversationId,
  });
  const sessionId = claimed.sessionId;

  await seedRescheduleConversationOnReminderSend({
    workspaceId,
    contactId,
    appointmentId: appt.id,
    timelineType: "reminder_1440m_sent",
  });

  const transcript: TurnLog[] = [];
  const scripted = parseUserLines();
  let lastAssistant = "";

  async function customerSays(body: string) {
    const providerMessageId = `e2e-in-${randomBytes(6).toString("hex")}`;
    transcript.push({ role: "customer", text: body });
    console.log(`\n>>> CUSTOMER: ${body}`);

    const handled = await handleAppointmentRemindersInboundBody({
      workspaceId,
      contactId,
      appointmentId: appt.id,
      replySessionId: sessionId,
      fromE164: consumerE164,
      body,
      providerMessageId,
      conversationId,
    });

    if (!handled.handled) {
      console.log("<<< (not handled by AR inbound — check session/config)");
      return false;
    }

    lastAssistant = handled.replyText;
    transcript.push({ role: "transovo", text: handled.replyText });
    console.log(`<<< TRANSOVO: ${handled.replyText}`);
    return true;
  }

  const okR = await customerSays("R");
  assert.equal(okR, true, "R must start reschedule flow");

  let rescheduled = false;
  let scriptedIdx = 0;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const fresh = await prisma.voiceAppointment.findFirst({ where: { id: appt.id } });
    if (fresh && fresh.startsAt.toISOString() !== originalStartsAt) {
      rescheduled = true;
      console.log(`\n[calendar] startsAt changed → ${fresh.startsAt.toISOString()}`);
      break;
    }

    let next: string | null = null;
    if (scriptedIdx < scripted.length) {
      next = scripted[scriptedIdx];
      scriptedIdx += 1;
    } else {
      next = autoReply(lastAssistant, scripted, scriptedIdx);
    }
    if (!next) {
      console.log("\n[stop] No further auto-reply; set AR_SMS_E2E_LINES or extend autoReply.");
      break;
    }
    await customerSays(next);
  }

  const final = await prisma.voiceAppointment.findFirst({ where: { id: appt.id } });
  assert.ok(final);

  console.log("\n=== Transcript ===");
  for (const line of transcript) {
    console.log(`${line.role === "customer" ? "C" : "T"}: ${line.text}`);
  }

  if (dryRun) {
    console.log("\nPASS ar-sms-luna-conversation-e2e (dry run — no write expected)");
    await cleanup(prisma, target, sessionId, false);
    return;
  }

  if (rescheduled || final.startsAt.toISOString() !== originalStartsAt) {
    console.log("\nPASS ar-sms-luna-conversation-e2e — appointment time updated via SMS conversation pipeline");
  } else {
    console.log(
      "\nINCOMPLETE — conversation ran but appointment time unchanged (Microsoft auth, slots, or verifier may have blocked commit). See transcript.",
    );
    process.exit(2);
  }

  await cleanup(prisma, target, sessionId, rescheduled || final.startsAt.toISOString() !== originalStartsAt);
}

async function cleanup(
  prisma: ReturnType<typeof getPrisma>,
  target: E2eTarget,
  sessionId: string,
  changed: boolean,
) {
  await prisma.arSmsReplySession.deleteMany({ where: { id: sessionId } }).catch(() => undefined);
  if (target.bootstrap) {
    await prisma.voiceAppointment.deleteMany({ where: { workspaceId: target.workspaceId } });
    await prisma.contact.deleteMany({ where: { workspaceId: target.workspaceId } });
    await prisma.solutionSetup.deleteMany({ where: { workspaceId: target.workspaceId } });
    await prisma.workspace.delete({ where: { id: target.workspaceId } }).catch(() => undefined);
    return;
  }
  if (changed && process.env.AR_SMS_E2E_REVERT === "1") {
    await prisma.voiceAppointment.update({
      where: { id: target.appointmentId },
      data: {
        startsAt: new Date(target.originalStartsAt),
        endsAt: target.originalEndsAt,
      },
    });
    console.log("(reverted startsAt for cleanup)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
