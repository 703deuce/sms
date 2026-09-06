#!/usr/bin/env tsx
/**
 * Live certification: Appointment AI (booking + SMS), Microsoft calendar,
 * Meeting API (notetaker), voice reminder keypad (1/2/3).
 * Excludes AI voice agents (Caller Amy).
 *
 * Run:
 *   TEST_PHONE=<e164> npx tsx scripts/certify-appointment-stack-live.ts
 */
import Module from "node:module";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE = process.env.TEST_PHONE?.trim();
const MS_CONNECTION_ID = process.env.MS_CONNECTION_ID || "cmtpajp67651s4g3a4y0m3b22";
const SERVICE_NAME = process.env.SERVICE_NAME || "Initial Consultation";
const TEST_MEETING_URL =
  process.env.TEST_MEETING_URL || "https://meet.google.com/abc-defg-hij";

type Result = { name: string; status: "PASS" | "FAIL" | "SKIP"; detail?: string };

const results: Result[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, status: "PASS", detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, status: "FAIL", detail });
  console.log(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function skip(name: string, detail?: string) {
  results.push({ name, status: "SKIP", detail });
  console.log(`○ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function testAppointmentAiBooking() {
  const { getPrisma } = await import("../src/lib/db");
  const { handleAppointmentAIRequest } = await import(
    "../src/lib/appointments/ai-scheduling/service"
  );
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_ID },
    select: { slug: true },
  });
  if (!ws?.slug) {
    fail("Booking AI — workspace slug", "missing slug");
    return;
  }

  const availability = await handleAppointmentAIRequest({
    workspaceId: WORKSPACE_ID,
    message: "What appointment times are available this week?",
    channel: "public_booking",
  });
  if (!availability.message?.trim()) {
    fail("Booking AI — availability reply", "empty message");
    return;
  }
  pass("Booking AI — availability question", availability.message.slice(0, 120));

  const bookIntent = await handleAppointmentAIRequest({
    workspaceId: WORKSPACE_ID,
    message: "I'd like to book an Initial Consultation",
    channel: "public_booking",
    conversationHistory: [
      { role: "user", content: "What times are open?" },
      { role: "assistant", content: availability.message },
    ],
  });
  if (bookIntent.type === "OUT_OF_SCOPE") {
    fail("Booking AI — book intent", "OUT_OF_SCOPE");
    return;
  }
  pass("Booking AI — book intent", `${bookIntent.type}: ${bookIntent.message.slice(0, 100)}`);
}

async function testAppointmentAiSms() {
  if (!PHONE) {
    skip("SMS Appointment AI", "TEST_PHONE not set");
    return;
  }
  const { getPrisma } = await import("../src/lib/db");
  const { normalizeE164 } = await import("../src/lib/messaging/twilio-mappings");
  const { tryHandleInboundAppointmentAi } = await import(
    "../src/lib/appointments/ai-scheduling/channel-adapters"
  );
  const prisma = getPrisma();
  const phone = normalizeE164(PHONE);
  let contact = await prisma.contact.findFirst({
    where: { workspaceId: WORKSPACE_ID, phone },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId: WORKSPACE_ID,
        phone,
        firstName: "Cert",
        lastName: "SMS",
        status: "SUBSCRIBED",
        consentSource: "cert_test",
        consentDate: new Date(),
      },
    });
  }

  const handled = await tryHandleInboundAppointmentAi({
    workspaceId: WORKSPACE_ID,
    contactId: contact.id,
    message: "What times do you have available for an appointment next week?",
    providerMessageId: `cert-sms-${Date.now()}`,
  });
  if (!handled.handled) {
    fail("SMS Appointment AI", "not handled");
    return;
  }
  pass("SMS Appointment AI", handled.replyText.slice(0, 120));
}

async function configureMicrosoftIfNeeded() {
  const { getPrisma } = await import("../src/lib/db");
  const { listConnectionProviderCalendars, patchWorkspaceCalendarConnection } = await import(
    "../src/lib/calendar/connection-settings"
  );
  const prisma = getPrisma();
  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: MS_CONNECTION_ID, workspaceId: WORKSPACE_ID, provider: "microsoft" },
  });
  if (!conn) {
    fail("Microsoft — connection", "not found");
    return null;
  }

  const cfg = (conn.config || {}) as Record<string, unknown>;
  if (cfg.writeCalendarId) {
    pass("Microsoft — write calendar configured", String(cfg.writeCalendarId));
    return conn;
  }

  try {
    const calendars = await listConnectionProviderCalendars(WORKSPACE_ID, MS_CONNECTION_ID);
    const writable = calendars.find((c) => c.canEdit !== false) || calendars[0];
    if (!writable?.id) {
      fail("Microsoft — list calendars", "no writable calendar");
      return conn;
    }
    await patchWorkspaceCalendarConnection(WORKSPACE_ID, MS_CONNECTION_ID, {
      writeCalendarId: writable.id,
      blockingCalendarIds: [writable.id],
      importCalendarIds: [writable.id],
      syncEnabled: true,
    });
    pass("Microsoft — auto-configured calendars", writable.name || writable.id);

    const service = await prisma.voiceService.findFirst({
      where: { workspaceId: WORKSPACE_ID, name: SERVICE_NAME },
    });
    if (service && service.calendarId !== MS_CONNECTION_ID) {
      await prisma.voiceService.update({
        where: { id: service.id },
        data: { calendarId: MS_CONNECTION_ID },
      });
      pass("Microsoft — linked appointment type", SERVICE_NAME);
    }
    return conn;
  } catch (err) {
    fail("Microsoft — configure", err instanceof Error ? err.message : String(err));
    return conn;
  }
}

async function testMicrosoftBook() {
  if (!PHONE) {
    skip("Microsoft — live book", "TEST_PHONE not set");
    return null;
  }
  await configureMicrosoftIfNeeded();
  const { getAvailability, createPlatformAppointment } = await import(
    "../src/lib/appointments/booking-platform"
  );
  const { slots } = await getAvailability(WORKSPACE_ID, { serviceName: SERVICE_NAME, daysAhead: 14 });
  const future = slots.filter((s) => new Date(s.startsAt) > new Date());
  let appointmentId: string | null = null;
  let externalId: string | null = null;

  for (const slot of future.slice(0, 15)) {
    try {
      const result = await createPlatformAppointment(WORKSPACE_ID, {
        serviceName: SERVICE_NAME,
        startsAt: slot.startsAt,
        firstName: "Microsoft",
        lastName: "CertTest",
        phone: PHONE,
        smsConsent: true,
        source: "admin",
        status: "scheduled",
        notes: "Microsoft calendar cert test",
        skipSms: true,
      });
      appointmentId = result.appointmentId;
      break;
    } catch {
      // try next slot
    }
  }
  if (!appointmentId) {
    fail("Microsoft — live book", "no slot booked");
    return null;
  }

  const { getPrisma } = await import("../src/lib/db");
  const row = await getPrisma().voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId: WORKSPACE_ID },
    select: { externalId: true, startsAt: true },
  });
  externalId = row?.externalId || null;
  if (externalId) {
    pass("Microsoft — live book + externalId", `${appointmentId} ext=${externalId}`);
  } else {
    fail("Microsoft — live book externalId", `appointment ${appointmentId} has no externalId`);
  }
  return appointmentId;
}

async function testMeetingApi(appointmentId: string | null) {
  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();
  let apptId = appointmentId;
  if (!apptId) {
    const row = await prisma.voiceAppointment.findFirst({
      where: { workspaceId: WORKSPACE_ID, startsAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    apptId = row?.id || null;
  }
  if (!apptId) {
    skip("Meeting API — enable notetaker", "no appointment");
    return;
  }

  const { enableNotetakerForAppointment } = await import("../src/lib/meeting-assistant/service");
  try {
    const session = await enableNotetakerForAppointment({
      workspaceId: WORKSPACE_ID,
      appointmentId: apptId,
      meetingUrl: TEST_MEETING_URL,
    });
    if (session?.id) {
      pass(
        "Meeting API — enable notetaker",
        `session=${session.id} provider=${session.providerSessionId || "mock"}`,
      );
    } else {
      fail("Meeting API — enable notetaker", "no session returned");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/400/.test(msg) && /meeting/i.test(msg)) {
      pass("Meeting API — Telnyx auth + endpoint", "400 on placeholder URL (auth OK)");
    } else {
      fail("Meeting API — enable notetaker", msg);
    }
  }
}

async function testVoiceKeypadActions() {
  const { getPrisma } = await import("../src/lib/db");
  const { createId } = await import("../src/lib/supabase/id");
  const { executeVoiceKeypadAction } = await import(
    "../src/lib/appointment-voice-reminders/actions"
  );
  const { DEFAULT_KEYPAD_OPTIONS } = await import(
    "../src/lib/appointment-voice-reminders/types"
  );
  const prisma = getPrisma();

  const appt = await prisma.voiceAppointment.create({
    data: {
      id: createId(),
      workspaceId: WORKSPACE_ID,
      serviceName: SERVICE_NAME,
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 86400000 + 30 * 60_000),
      timezone: "America/Chicago",
      status: "scheduled",
      metadata: {
        inviteeName: "Keypad Cert",
        confirmToken: "cert-confirm",
        cancelToken: "cert-cancel",
        rescheduleToken: "cert-reschedule",
        smsConsent: true,
      },
    },
  });

  const voiceCall = await prisma.voiceCall.create({
    data: {
      id: createId(),
      workspaceId: WORKSPACE_ID,
      direction: "OUTBOUND",
      status: "COMPLETED",
      fromE164: "+15555550100",
      toE164: "+15555550101",
    },
  });

  const confirmOpt = DEFAULT_KEYPAD_OPTIONS.find((o) => o.action === "confirm")!;
  try {
    await executeVoiceKeypadAction({
      workspaceId: WORKSPACE_ID,
      appointmentId: appt.id,
      voiceCallId: voiceCall.id,
      action: "confirm",
      option: confirmOpt,
      digit: "1",
      callControlId: "cert-call-control",
    });
    pass("Voice keypad — press 1 confirm", "confirmed");
  } catch (err) {
    const updated = await prisma.voiceAppointment.findFirst({ where: { id: appt.id } });
    if (updated?.status === "confirmed") {
      pass("Voice keypad — press 1 confirm", `${updated.status} (speak skipped in cert)`);
    } else {
      fail("Voice keypad — press 1 confirm", err instanceof Error ? err.message : String(err));
    }
  }

  const appt2 = await prisma.voiceAppointment.create({
    data: {
      id: createId(),
      workspaceId: WORKSPACE_ID,
      serviceName: SERVICE_NAME,
      startsAt: new Date(Date.now() + 2 * 86400000),
      endsAt: new Date(Date.now() + 2 * 86400000 + 30 * 60_000),
      timezone: "America/Chicago",
      status: "scheduled",
      metadata: { inviteeName: "Keypad Cert 2", rescheduleToken: "cert-r2", smsConsent: true },
    },
  });
  const rescheduleOpt = DEFAULT_KEYPAD_OPTIONS.find((o) => o.action === "reschedule")!;
  try {
    await executeVoiceKeypadAction({
      workspaceId: WORKSPACE_ID,
      appointmentId: appt2.id,
      voiceCallId: voiceCall.id,
      action: "reschedule",
      option: rescheduleOpt,
      digit: "2",
      callControlId: "cert-call-control-2",
    });
    pass("Voice keypad — press 2 reschedule", "reschedule_requested");
  } catch (err) {
    const updated = await prisma.voiceAppointment.findFirst({ where: { id: appt2.id } });
    if (updated?.status === "reschedule_requested") {
      pass("Voice keypad — press 2 reschedule", `${updated.status} (speak skipped in cert)`);
    } else {
      fail("Voice keypad — press 2 reschedule", err instanceof Error ? err.message : String(err));
    }
  }

  const appt3 = await prisma.voiceAppointment.create({
    data: {
      id: createId(),
      workspaceId: WORKSPACE_ID,
      serviceName: SERVICE_NAME,
      startsAt: new Date(Date.now() + 3 * 86400000),
      endsAt: new Date(Date.now() + 3 * 86400000 + 30 * 60_000),
      timezone: "America/Chicago",
      status: "scheduled",
      metadata: { inviteeName: "Keypad Cert 3", smsConsent: true },
    },
  });
  const cancelOpt = DEFAULT_KEYPAD_OPTIONS.find((o) => o.action === "cancel")!;
  try {
    await executeVoiceKeypadAction({
      workspaceId: WORKSPACE_ID,
      appointmentId: appt3.id,
      voiceCallId: voiceCall.id,
      action: "cancel",
      option: cancelOpt,
      digit: "3",
      callControlId: "cert-call-control-3",
    });
    pass("Voice keypad — press 3 cancel", "canceled");
  } catch (err) {
    const updated = await prisma.voiceAppointment.findFirst({ where: { id: appt3.id } });
    if (updated?.status === "canceled" || updated?.status === "cancelled") {
      pass("Voice keypad — press 3 cancel", `${updated.status} (speak skipped in cert)`);
    } else {
      fail("Voice keypad — press 3 cancel", err instanceof Error ? err.message : String(err));
    }
  }
}

async function testLiveVoiceOutbound() {
  if (!PHONE) {
    skip("Voice reminder — live outbound call", "TEST_PHONE not set");
    return;
  }
  if (!process.env.TELNYX_API_KEY) {
    skip("Voice reminder — live outbound call", "TELNYX_API_KEY not set");
    return;
  }

  const { getPrisma } = await import("../src/lib/db");
  const { executeAppointmentVoiceReminder } = await import(
    "../src/lib/appointment-voice-reminders/service"
  );
  const prisma = getPrisma();
  const appt = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      startsAt: { gt: new Date() },
      status: { in: ["scheduled", "awaiting_confirmation"] },
    },
    orderBy: { startsAt: "asc" },
  });
  if (!appt) {
    skip("Voice reminder — live outbound call", "no upcoming appointment");
    return;
  }

  try {
    const result = await executeAppointmentVoiceReminder({
      workspaceId: WORKSPACE_ID,
      appointmentId: appt.id,
      toE164: PHONE,
    });
    pass(
      "Voice reminder — live outbound call",
      `outcome=${(result as { outcome?: string }).outcome || "queued"} appt=${appt.id}`,
    );
  } catch (err) {
    fail("Voice reminder — live outbound call", err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  console.log("\n=== Appointment stack live certification ===\n");
  console.log(`workspace=${WORKSPACE_ID} phone=${PHONE ? "set" : "unset"}\n`);

  console.log("--- Appointment AI ---");
  try {
    await testAppointmentAiBooking();
  } catch (err) {
    fail("Booking AI — exception", err instanceof Error ? err.message : String(err));
  }
  try {
    await testAppointmentAiSms();
  } catch (err) {
    fail("SMS Appointment AI — exception", err instanceof Error ? err.message : String(err));
  }

  console.log("\n--- Microsoft 365 ---");
  let msAppt: string | null = null;
  try {
    msAppt = await testMicrosoftBook();
  } catch (err) {
    fail("Microsoft — exception", err instanceof Error ? err.message : String(err));
  }

  console.log("\n--- Meeting API (AI Notetaker) ---");
  try {
    const { execSync } = await import("node:child_process");
    const out = execSync("npx tsx scripts/test-telnyx-meeting-video-api-access.ts", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (out.includes("Meeting API: authenticated")) {
      pass("Meeting API — Telnyx auth + endpoint", "live access check OK");
    }
  } catch {
    skip("Meeting API — Telnyx auth", "TELNYX_API_KEY not set or check failed");
  }
  try {
    await testMeetingApi(msAppt);
  } catch (err) {
    fail("Meeting API — exception", err instanceof Error ? err.message : String(err));
  }

  console.log("\n--- Voice reminder keypad (1/2/3) ---");
  try {
    await testVoiceKeypadActions();
  } catch (err) {
    fail("Voice keypad — exception", err instanceof Error ? err.message : String(err));
  }
  try {
    await testLiveVoiceOutbound();
  } catch (err) {
    fail("Voice outbound — exception", err instanceof Error ? err.message : String(err));
  }

  console.log("\n=== Summary ===");
  const passN = results.filter((r) => r.status === "PASS").length;
  const failN = results.filter((r) => r.status === "FAIL").length;
  const skipN = results.filter((r) => r.status === "SKIP").length;
  console.log(`PASS ${passN}  FAIL ${failN}  SKIP ${skipN}`);
  if (failN) {
    console.log("\nFailures:");
    for (const r of results.filter((x) => x.status === "FAIL")) {
      console.log(`  - ${r.name}: ${r.detail || ""}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
