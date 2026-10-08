/**
 * Live two-way SMS cert on ws_1:
 * - Platform sender → customer +15714073615 (571-407-3615) appointment reminder
 * - Customer replies via Telnyx (C / R / X flows)
 * - Drains AR jobs when production worker is slow; polls Telnyx for platform replies
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-ws1-live-sms-crx-e2e.ts
 *
 * Env:
 *   WORKSPACE_ID=ws_1 (default)
 *   AR_LIVE_CUSTOMER_E164=+15714073615 (customer / reply-from line)
 *   AR_LIVE_SCENARIOS=C,R,X  (subset ok)
 *   AR_LIVE_MS_CONNECTION_ID=cmu1uq7f15s1o5s4f6c5b6a57
 *   VOICE_AGENT_ID=cmshz2lc25c622c4i58303501
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { requireIsolatedArTestDatabase } from "./cloud-agent/ar-test-database-guard";
import { hydrateProdTestEnvFromCoolify } from "./cloud-agent/hydrate-prod-test-env";
import { providers } from "@/lib/ai/llm-providers";
import { getPrisma } from "@/lib/db";
import { formatImportedExternalId } from "@/lib/calendar/external-id";
import { createId } from "@/lib/supabase/id";
import { DEFAULT_PLATFORM_CONFIG } from "@/lib/appointments/types";
import { saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { upsertWorkspaceAppointmentByExternalId } from "@/lib/appointments/domain";
import { resetAppointmentReminders } from "@/lib/appointments/reminder-state";
import { resolveAiReschedulerConfig } from "@/lib/appointment-reminders/ai-rescheduler/types";
import { AR_REPLY_INSTRUCTIONS_SUFFIX } from "@/lib/appointment-reminders/ai-rescheduler/types";
import { seedRescheduleConversationOnReminderSend } from "@/lib/appointment-reminders/ai-rescheduler/inbound-replies";
import { sendArReminderSmsWithSession } from "@/lib/appointment-reminders/messaging/outbound-reminder";
import { selectArOutboundPlatformSender } from "@/lib/appointment-reminders/messaging/reply-session";
import { AR_QUEUE_NAME } from "@/lib/appointment-reminders/messaging/constants";
import { executeMicrosoftCreateBooking } from "@/lib/voice-v3/calendar/microsoft/microsoft-create-booking";
import { resolveVoiceV3MicrosoftCalendar } from "@/lib/voice-v3/calendar/microsoft/resolve-voice-v3-microsoft-calendar";
import { resolveVoiceV3AgentConfigForAgent } from "@/lib/voice-v3/config/from-published-agent";
import { wallTimeInZoneToUtc } from "@/lib/voice-v3/time/timezone";
import { claimDueJobs, completeJob, failJob } from "@/lib/messaging/enqueue-advance";
import { handleJob } from "@/lib/jobs/job-handlers";
import { JobDeferredError, JobFailedError } from "@/lib/messaging/types";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const CUSTOMER_E164 = process.env.AR_LIVE_CUSTOMER_E164?.trim() || "+15714073615";
const MS_CONNECTION_ID =
  process.env.AR_LIVE_MS_CONNECTION_ID?.trim() || "cmu1uq7f15s1o5s4f6c5b6a57";
const AGENT_ID = process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";
const SCENARIOS = (process.env.AR_LIVE_SCENARIOS || "C,R,X")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter((s) => s === "C" || s === "R" || s === "X");

const AR_JOB_TYPES = ["ar_process_inbound_sms", "ar_send_customer_sms"];

function hydrateProdEnvVars(names: string[]): number {
  const missing = names.filter((n) => !process.env[n]?.trim());
  if (!missing.length) return 0;
  const remote = [
    "set -euo pipefail",
    "cid=$(docker ps --filter name=ds8s3hjin60qs6g7s0iqkixs --format '{{.ID}}' | head -1)",
    'if [ -z "$cid" ]; then exit 2; fi',
    ...missing.map(
      (v) =>
        `val=$(docker exec "$cid" printenv ${v} 2>/dev/null || true); if [ -n "$val" ]; then printf '%s=%s\\n' '${v}' "$val"; fi`,
    ),
  ].join("; ");
  try {
    const out = execFileSync(
      "ssh",
      ["-o", "BatchMode=yes", "-o", "ConnectTimeout=20", "coolify-server", "bash", "-lc", remote],
      { encoding: "utf8", maxBuffer: 64_000 },
    );
    let applied = 0;
    for (const line of out.split("\n")) {
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq);
      const value = line.slice(eq + 1);
      if (value.trim() && missing.includes(key)) {
        process.env[key] = value;
        applied += 1;
      }
    }
    return applied;
  } catch {
    return 0;
  }
}

function hydrateTelnyxApiKey(): void {
  hydrateProdEnvVars(["TELNYX_API_KEY"]);
  if (process.env.TELNYX_API_KEY?.trim()) return;
  const remote = [
    "set -euo pipefail",
    "cid=$(docker ps --filter name=ds8s3hjin60qs6g7s0iqkixs --format '{{.ID}}' | head -1)",
    'if [ -z "$cid" ]; then exit 2; fi',
    "val=$(docker exec \"$cid\" printenv TELNYX_API_KEY 2>/dev/null || true)",
    'if [ -n "$val" ]; then printf "%s" "$val"; fi',
  ].join("; ");
  try {
    const key = execFileSync(
      "ssh",
      ["-o", "BatchMode=yes", "-o", "ConnectTimeout=20", "coolify-server", "bash", "-lc", remote],
      { encoding: "utf8", maxBuffer: 16_000 },
    ).trim();
    if (key) process.env.TELNYX_API_KEY = key;
  } catch {
    /* optional */
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function telnyxSend(from: string, to: string, text: string): Promise<string> {
  const apiKey = process.env.TELNYX_API_KEY?.trim();
  if (!apiKey) throw new Error("TELNYX_API_KEY missing — cannot send customer SMS");
  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, text }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { id?: string };
    errors?: Array<{ detail?: string }>;
  };
  if (!res.ok) {
    throw new Error(
      `telnyx_send_failed ${res.status}: ${json.errors?.[0]?.detail || JSON.stringify(json).slice(0, 200)}`,
    );
  }
  const id = json.data?.id;
  if (!id) throw new Error("telnyx_send_missing_message_id");
  return id;
}

async function waitForInboundSmsToCustomer(
  customerE164: string,
  sinceIso: string,
  timeoutMs: number,
): Promise<string | null> {
  const apiKey = process.env.TELNYX_API_KEY?.trim();
  if (!apiKey) return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = new URL("https://api.telnyx.com/v2/messages");
    url.searchParams.set("filter[to]", customerE164);
    url.searchParams.set("page[size]", "10");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<{ direction?: string; text?: string; received_at?: string; sent_at?: string }>;
      };
      for (const row of json.data || []) {
        if (row.direction !== "outbound") continue;
        const ts = row.received_at || row.sent_at || "";
        if (ts && ts >= sinceIso && (row.text || "").trim()) {
          return (row.text || "").trim();
        }
      }
    }
    await sleep(4000);
  }
  return null;
}

async function drainArJobs(maxRounds = 12): Promise<number> {
  let processed = 0;
  for (let round = 0; round < maxRounds; round += 1) {
    const claimed = await claimDueJobs(15, {
      jobTypes: AR_JOB_TYPES,
      queueNames: [AR_QUEUE_NAME],
    });
    if (!claimed.length) break;
    for (const job of claimed) {
      try {
        await handleJob(job.jobType, (job.payload || {}) as Record<string, unknown>);
        await completeJob(job.id);
        processed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof JobFailedError) {
          await failJob(job.id, message, undefined, undefined, true);
        } else {
          const deferMs = err instanceof JobDeferredError ? err.deferMs : 15_000;
          const soft = err instanceof JobDeferredError ? err.soft : false;
          await failJob(job.id, message, deferMs, soft);
        }
      }
    }
  }
  return processed;
}

async function expireStaleArSessionsForLiveCert(prisma: ReturnType<typeof getPrisma>) {
  const { markArReplySessionLifecycle } = await import(
    "@/lib/appointment-reminders/messaging/reply-session"
  );
  const rows = await prisma.arSmsReplySession.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      consumerE164: CUSTOMER_E164,
      lifecycleState: { in: ["AWAITING_REPLY", "RESCHEDULING", "AWAITING_CANCEL_CONFIRM"] },
    },
    select: { id: true },
    take: 20,
  });
  for (const row of rows) {
    await markArReplySessionLifecycle({
      sessionId: row.id,
      workspaceId: WORKSPACE_ID,
      lifecycleState: "EXPIRED",
    }).catch(() => undefined);
  }
  if (rows.length) {
    console.log(`  [setup] expired ${rows.length} stale AR reply session(s) for cert customer`);
  }
}

async function ensureCustomerContact(prisma: ReturnType<typeof getPrisma>) {
  let contact = await prisma.contact.findFirst({
    where: { workspaceId: WORKSPACE_ID, phone: CUSTOMER_E164 },
    select: { id: true, phone: true, firstName: true },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        workspaceId: WORKSPACE_ID,
        phone: CUSTOMER_E164,
        firstName: "AR",
        lastName: "LiveCert",
        status: "SUBSCRIBED",
        consentSource: "manual",
      },
      select: { id: true, phone: true, firstName: true },
    });
  }
  return contact;
}

function slotDaysAhead(days: number, hour: number, minute: number, timezone: string) {
  const probe = new Date(Date.now() + days * 86400000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(probe);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const start = wallTimeInZoneToUtc(timezone, y, m, d, hour, minute);
  const end = new Date(start.getTime() + 60 * 60_000);
  return { start, end };
}

async function createPlatformOnlyFixtureAppointment(contactId: string, daysAhead: number, label: string) {
  const config = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
  });
  const slot = slotDaysAhead(daysAhead, 16, 0, config.timezone);
  const meta = resetAppointmentReminders({
    smsConsent: true,
    inviteePhone: CUSTOMER_E164,
    inviteeName: "AR Live Cert",
    source: "transovo",
  });
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.create({
    data: {
      workspaceId: WORKSPACE_ID,
      contactId,
      startsAt: slot.start,
      endsAt: slot.end,
      timezone: config.timezone,
      status: "scheduled",
      serviceName: config.service.name,
      metadata: meta as object,
    },
  });
  console.log(`  [fixture] platform-only appointment ${row.id} (${label})`);
  return { appointmentId: row.id, startsAt: slot.start, externalId: null, providerEventId: null };
}

async function createMicrosoftFixtureAppointment(
  contactId: string,
  daysAhead: number,
  label: string,
) {
  const config = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
  });
  const resolved = await resolveVoiceV3MicrosoftCalendar(config);
  if (!resolved.ok) {
    console.warn(`  [fixture] ${resolved.message}; using platform-only row`);
    return createPlatformOnlyFixtureAppointment(contactId, daysAhead, `${label}_no_ms`);
  }

  const slot = slotDaysAhead(daysAhead, 15, 0, config.timezone);
  const bookingAttemptId = `ar_live_sms_${label}_${Date.now()}`;
  const calendarId = resolved.calendarIds[0] ?? "primary";

  const created = await executeMicrosoftCreateBooking({
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
    request: {
      callId: `ar_live_${createId()}`,
      bookingAttemptId,
      schedulingGeneration: 1,
      offerSetId: "ar_live",
      slotId: "ar_live_slot",
      calendarId,
      startUtc: slot.start.toISOString(),
      endUtc: slot.end.toISOString(),
      timezone: config.timezone,
      customer: {
        name: "AR Live Cert",
        phone: CUSTOMER_E164,
      },
      service: {
        id: config.service.id,
        name: config.service.name,
        durationMinutes: config.service.durationMinutes,
      },
    },
  });
  if (!created.ok) {
    console.warn(
      `  [fixture] Microsoft create failed (${created.reason}); using platform-only row for SMS cert`,
    );
    return createPlatformOnlyFixtureAppointment(contactId, daysAhead, `${label}_fallback`);
  }

  const connectionId = resolved.connectionId;
  const externalId = formatImportedExternalId(
    "microsoft",
    connectionId,
    created.providerEventId,
  );

  const meta = resetAppointmentReminders({
    smsConsent: true,
    inviteePhone: CUSTOMER_E164,
    inviteeName: "AR Live Cert",
    source: "calendar_import",
    provider: "microsoft",
    connectionId,
    providerEventId: created.providerEventId,
  });

  const row = await upsertWorkspaceAppointmentByExternalId({
    workspaceId: WORKSPACE_ID,
    externalId,
    create: {
      contactId,
      callId: null,
      serviceName: config.service.name,
      staffName: null,
      startsAt: slot.start,
      endsAt: slot.end,
      timezone: config.timezone,
      status: "scheduled",
      metadata: meta,
    },
    update: {
      contactId,
      startsAt: slot.start,
      endsAt: slot.end,
      status: "scheduled",
      metadata: meta,
    },
  });

  return {
    appointmentId: row.id,
    startsAt: slot.start,
    externalId,
    providerEventId: created.providerEventId,
  };
}

async function sendReminderAndSession(input: {
  appointmentId: string;
  contactId: string;
  startsAt: Date;
  serviceName: string;
}) {
  const picked = await selectArOutboundPlatformSender({
    workspaceId: WORKSPACE_ID,
    appointmentId: input.appointmentId,
    consumerE164: CUSTOMER_E164,
  });
  assert.equal(picked.ok, true, `platform sender: ${!picked.ok ? picked.reason : ""}`);
  assert.equal(picked.provider, "telnyx", "appointment reminders must send via Telnyx");
  assert.ok(
    picked.e164.startsWith("+1866"),
    `expected canonical Telnyx 866 platform sender, got ${picked.e164}`,
  );

  const when = input.startsAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const body = `Reminder: ${input.serviceName} on ${when}.${AR_REPLY_INSTRUCTIONS_SUFFIX}`;

  const sent = await sendArReminderSmsWithSession({
    workspaceId: WORKSPACE_ID,
    appointmentId: input.appointmentId,
    contactId: input.contactId,
    phone: CUSTOMER_E164,
    body,
    timelineType: "reminder_1440m_sent",
  });
  assert.equal(sent.sent, true, `reminder send: ${!sent.sent ? sent.reason : ""}`);

  await seedRescheduleConversationOnReminderSend({
    workspaceId: WORKSPACE_ID,
    contactId: input.contactId,
    appointmentId: input.appointmentId,
    timelineType: "reminder_1440m_sent",
  });

  return { sessionId: sent.sessionId!, platformE164: picked.e164 };
}

async function customerReply(platformE164: string, text: string) {
  const since = new Date().toISOString();
  const providerMessageId = await telnyxSend(CUSTOMER_E164, platformE164, text);
  console.log(`  [sms] customer → platform: "${text}" (id ${providerMessageId.slice(0, 12)}…)`);
  await sleep(8000);
  await drainArJobs();
  await sleep(5000);
  await drainArJobs();
  const reply = await waitForInboundSmsToCustomer(CUSTOMER_E164, since, 90_000);
  if (reply) console.log(`  [sms] platform → customer: ${reply.slice(0, 160)}${reply.length > 160 ? "…" : ""}`);
  else console.log("  [sms] (no Telnyx outbound to customer within timeout — check worker / conversation)");
  return { providerMessageId, reply };
}

function autoFollowUp(assistant: string): string | null {
  const a = assistant.toLowerCase();
  if (/reply yes to confirm/.test(a)) return "YES";
  if (/what day|what time|works better|when would/.test(a)) return "Friday afternoon";
  if (/which works|which time|which one|pick one|options/.test(a) || /\d{1,2}:\d{2}/.test(assistant)) {
    return "the second one";
  }
  if (/confirm|go ahead|would you like me to|is that correct|sound good/.test(a)) return "Yes";
  return null;
}

async function runConfirmScenario(contactId: string, daysAhead: number) {
  console.log("\n=== Scenario C (confirm) ===");
  const fixture = await createMicrosoftFixtureAppointment(contactId, daysAhead, "confirm");
  const { platformE164 } = await sendReminderAndSession({
    appointmentId: fixture.appointmentId,
    contactId,
    startsAt: fixture.startsAt,
    serviceName: "Consultation",
  });
  const { reply } = await customerReply(platformE164, "C");
  const row = await getPrisma().voiceAppointment.findFirst({ where: { id: fixture.appointmentId } });
  assert.ok(row);
  assert.equal(row.status, "confirmed", "appointment should be confirmed after C");
  assert.ok(reply?.toLowerCase().includes("confirm"), "SMS reply should acknowledge confirmation");
  console.log("PASS scenario C");
}

async function runCancelScenario(contactId: string, daysAhead: number) {
  console.log("\n=== Scenario X (cancel) ===");
  const fixture = await createMicrosoftFixtureAppointment(contactId, daysAhead, "cancel");
  const { platformE164 } = await sendReminderAndSession({
    appointmentId: fixture.appointmentId,
    contactId,
    startsAt: fixture.startsAt,
    serviceName: "Consultation",
  });
  let { reply } = await customerReply(platformE164, "X");
  assert.ok(reply?.toLowerCase().includes("yes"), "X should prompt YES confirmation");
  ({ reply } = await customerReply(platformE164, "YES"));
  const row = await getPrisma().voiceAppointment.findFirst({ where: { id: fixture.appointmentId } });
  assert.ok(row);
  const status = row.status.toLowerCase();
  assert.ok(
    status === "canceled" || status === "cancelled",
    `expected canceled status, got ${row.status}`,
  );
  assert.ok(reply?.toLowerCase().includes("cancel"), "SMS should confirm cancellation");
  console.log("PASS scenario X");
}

async function runRescheduleScenario(contactId: string, daysAhead: number) {
  console.log("\n=== Scenario R (reschedule) ===");
  const fixture = await createMicrosoftFixtureAppointment(contactId, daysAhead, "reschedule");
  const originalStartsAt = fixture.startsAt.toISOString();
  const { platformE164 } = await sendReminderAndSession({
    appointmentId: fixture.appointmentId,
    contactId,
    startsAt: fixture.startsAt,
    serviceName: "Consultation",
  });
  let { reply } = await customerReply(platformE164, "R");
  assert.ok(reply, "R should produce an assistant reply");

  for (let turn = 0; turn < 8; turn += 1) {
    const fresh = await getPrisma().voiceAppointment.findFirst({ where: { id: fixture.appointmentId } });
    if (fresh && fresh.startsAt.toISOString() !== originalStartsAt) {
      console.log(`  [calendar] rescheduled → ${fresh.startsAt.toISOString()}`);
      console.log("PASS scenario R");
      return;
    }
    const next = autoFollowUp(reply || "");
    if (!next) {
      console.log("  [stop] could not auto-reply; last:", reply?.slice(0, 120));
      break;
    }
    ({ reply } = await customerReply(platformE164, next));
  }
  const final = await getPrisma().voiceAppointment.findFirst({ where: { id: fixture.appointmentId } });
  assert.ok(final);
  assert.notEqual(
    final.startsAt.toISOString(),
    originalStartsAt,
    "appointment time should change after reschedule conversation",
  );
  console.log("PASS scenario R");
}

async function main() {
  console.log("=== AR ws_1 live SMS C/R/X E2E ===\n");
  process.env.QUEUE_DRIVER = "db";
  delete process.env.REDIS_URL;
  process.env.TRANSOVO_OAUTH_MUTATION_SOURCE =
    process.env.TRANSOVO_OAUTH_MUTATION_SOURCE?.trim() || "production_web";
  requireIsolatedArTestDatabase();
  hydrateProdTestEnvFromCoolify();
  hydrateTelnyxApiKey();
  hydrateProdEnvVars(["TELNYX_API_KEY", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"]);

  await expireStaleArSessionsForLiveCert(getPrisma());

  if (!process.env.TELNYX_API_KEY?.trim()) {
    console.error("FAIL — TELNYX_API_KEY not available");
    process.exit(1);
  }
  if (!providers().length) {
    console.error("FAIL — no LLM provider for Luna reschedule");
    process.exit(1);
  }

  const prisma = getPrisma();
  const contact = await ensureCustomerContact(prisma);

  await saveAppointmentPlatformConfig(WORKSPACE_ID, {
    ...DEFAULT_PLATFORM_CONFIG,
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

  console.log({
    workspaceId: WORKSPACE_ID,
    customer: CUSTOMER_E164,
    scenarios: SCENARIOS,
    agentId: AGENT_ID,
  });

  let dayOffset = 21;
  for (const letter of SCENARIOS) {
    if (letter === "C") await runConfirmScenario(contact.id, dayOffset++);
    if (letter === "X") await runCancelScenario(contact.id, dayOffset++);
    if (letter === "R") await runRescheduleScenario(contact.id, dayOffset++);
  }

  console.log("\nALL REQUESTED SCENARIOS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
