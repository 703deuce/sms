#!/usr/bin/env npx tsx
/**
 * Live Microsoft appointment management cert (no voice agent):
 *   1) find existing by customer identity (Anthony Johnson / phone)
 *   2) create a fresh Graph event (production BOOK shape)
 *   3) find the created event via findExistingAppointment
 *   4) reschedule (PATCH start/end)
 *   5) cancel (DELETE)
 *
 * Requires DATABASE_URL and a connected Microsoft voiceCalendarConnection for the agent.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/cert-voice-v3-microsoft-appointment-live.ts
 *
 * Env:
 *   WORKSPACE_ID (default ws_1)
 *   VOICE_AGENT_ID (default cmshz2lc25c622c4i58303501)
 *   CUSTOMER_NAME (default Anthony Johnson)
 *   CUSTOMER_PHONE (default 5714776175 — US; normalized to E.164)
 *   CUSTOMER_EMAIL (optional)
 *   LIVE_CERT_SKIP_CREATE=1 — only run initial find
 */
import { createId } from "@/lib/supabase/id";
import { findExistingAppointment } from "@/lib/voice-v3/calendar/find-existing-appointment";
import { executeMicrosoftCreateBooking } from "@/lib/voice-v3/calendar/microsoft/microsoft-create-booking";
import { executeMicrosoftUpdateBooking } from "@/lib/voice-v3/calendar/microsoft/microsoft-update-booking";
import { executeMicrosoftCancelBooking } from "@/lib/voice-v3/calendar/microsoft/microsoft-cancel-booking";
import {
  reconcileMicrosoftCancelOutcome,
  reconcileMicrosoftRescheduleOutcome,
} from "@/lib/voice-v3/calendar/microsoft/microsoft-reconcile-mutation-outcome";
import { resolveVoiceV3MicrosoftCalendar } from "@/lib/voice-v3/calendar/microsoft/resolve-voice-v3-microsoft-calendar";
import { resolveVoiceV3AgentConfigForAgent } from "@/lib/voice-v3/config/from-published-agent";
import type { ExistingAppointment } from "@/lib/voice-v3/calendar/appointment-management-types";
import type { FindExistingAppointmentResult } from "@/lib/voice-v3/calendar/appointment-management-types";
import { wallTimeInZoneToUtc } from "@/lib/voice-v3/time/timezone";
import { normalizePhoneDigits } from "@/lib/voice-v3/calendar/appointment-discovery-identity";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const AGENT_ID =
  process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";
const CUSTOMER_NAME = process.env.CUSTOMER_NAME?.trim() || "Anthony Johnson";
const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL?.trim() || undefined;
const SKIP_CREATE = process.env.LIVE_CERT_SKIP_CREATE === "1";

function usPhoneToE164(raw: string): string {
  const digits = normalizePhoneDigits(raw);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trim().startsWith("+")) return raw.trim();
  throw new Error(`Could not normalize US phone: ${raw}`);
}

const CUSTOMER_PHONE_E164 = usPhoneToE164(
  process.env.CUSTOMER_PHONE?.trim() || "5714776175",
);

type StepResult = {
  step: string;
  ok: boolean;
  detail: Record<string, unknown>;
};

const report: StepResult[] = [];

function logStep(step: string, ok: boolean, detail: Record<string, unknown>) {
  report.push({ step, ok, detail });
  console.log(
    JSON.stringify({ event: "LIVE_MS_APPT_CERT_STEP", step, ok, ...detail }),
  );
}

function summarizeFind(label: string, result: FindExistingAppointmentResult) {
  if (result.status === "FOUND") {
    logStep(label, true, {
      status: result.status,
      providerEventId: result.appointment.providerEventId,
      localStart: result.appointment.localStart,
      selectionId: result.appointment.internalBookingId,
    });
    return result.appointment;
  }
  if (result.status === "MULTIPLE") {
    logStep(label, true, {
      status: result.status,
      candidateCount: result.candidateSet.candidates.length,
      discriminators: result.usefulDiscriminators,
      candidates: result.candidateSet.candidates.map((c) => ({
        localStart: c.appointment.localStart,
        providerEventId: c.appointment.providerEventId,
      })),
    });
    return null;
  }
  if (result.status === "NEEDS_MORE_INFORMATION") {
    logStep(label, true, {
      status: result.status,
      usefulDiscriminators: result.usefulDiscriminators,
    });
    return null;
  }
  logStep(label, result.status !== "NONE", {
    status: result.status,
    reason: result.status === "VERIFICATION_FAILED" ? result.reason : undefined,
  });
  return null;
}

function pickSlotDaysAhead(days: number, hour: number, minute: number, timezone: string) {
  const now = new Date();
  const jitterDays = Number(process.env.LIVE_CERT_DAY_JITTER ?? "0");
  const probe = new Date(now.getTime() + (days + jitterDays) * 24 * 60 * 60_000);
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
  const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { start, end, ymd };
}

async function runFind(
  config: Awaited<ReturnType<typeof resolveVoiceV3AgentConfigForAgent>>,
  input: {
    label: string;
    dateExpression?: string;
    callId: string;
  },
) {
  const result = await findExistingAppointment(
    {
      callId: input.callId,
      customerName: CUSTOMER_NAME,
      phone: CUSTOMER_PHONE_E164,
      email: CUSTOMER_EMAIL,
      microsoftLookup: true,
      timezone: config.timezone,
      ani: CUSTOMER_PHONE_E164,
      dateExpression: input.dateExpression ?? null,
    },
    config,
  );
  return summarizeFind(input.label, result);
}

async function main() {
  const config = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
  });
  const resolved = await resolveVoiceV3MicrosoftCalendar(config);
  if (!resolved.ok) {
    console.error("CALENDAR_RESOLVE_FAILED", resolved.message);
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      event: "LIVE_MS_APPT_CERT_START",
      workspaceId: WORKSPACE_ID,
      agentId: AGENT_ID,
      customerName: CUSTOMER_NAME,
      customerPhoneE164: CUSTOMER_PHONE_E164,
      timezone: config.timezone,
      connectionId: resolved.connectionId,
      calendarIds: resolved.calendarIds,
    }),
  );

  await runFind(config, { label: "find_initial_existing", callId: `cert_find_${createId()}` });

  if (SKIP_CREATE) {
    console.log(JSON.stringify({ event: "LIVE_MS_APPT_CERT_DONE", report, skipped: "create" }));
    return;
  }

  const slot = pickSlotDaysAhead(14, 15, 0, config.timezone);
  const bookingAttemptId = `live_mgmt_cert_${Date.now()}`;
  const calendarId = resolved.calendarIds[0] ?? "primary";

  const created = await executeMicrosoftCreateBooking({
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
    request: {
      callId: `cert_create_${createId()}`,
      bookingAttemptId,
      schedulingGeneration: 1,
      offerSetId: "cert_offer",
      slotId: "cert_slot",
      calendarId,
      startUtc: slot.start.toISOString(),
      endUtc: slot.end.toISOString(),
      timezone: config.timezone,
      customer: {
        name: CUSTOMER_NAME,
        phone: CUSTOMER_PHONE_E164,
        email: CUSTOMER_EMAIL,
      },
      service: {
        id: config.service.id,
        name: config.service.name,
        durationMinutes: config.service.durationMinutes,
      },
    },
  });

  if (!created.ok) {
    logStep("create_appointment", false, created);
    console.log(JSON.stringify({ event: "LIVE_MS_APPT_CERT_DONE", report }));
    process.exit(1);
  }

  logStep("create_appointment", true, {
    providerEventId: created.providerEventId,
    providerCalendarId: created.providerCalendarId,
    bookingAttemptId,
    localDate: slot.ymd,
    startUtc: slot.start.toISOString(),
    endUtc: slot.end.toISOString(),
  });

  const foundAfterCreate = await runFind(config, {
    label: "find_after_create",
    dateExpression: slot.ymd,
    callId: `cert_find_after_${createId()}`,
  });

  let appointment: ExistingAppointment | null = foundAfterCreate;
  if (!appointment) {
    const retry = await findExistingAppointment(
      {
        callId: `cert_find_retry_${createId()}`,
        customerName: CUSTOMER_NAME,
        phone: CUSTOMER_PHONE_E164,
        email: CUSTOMER_EMAIL,
        microsoftLookup: true,
        timezone: config.timezone,
        ani: CUSTOMER_PHONE_E164,
        dateExpression: slot.ymd,
      },
      config,
    );
    if (retry.status === "FOUND") {
      appointment = retry.appointment;
    } else if (retry.status === "MULTIPLE") {
      appointment =
        retry.candidateSet.candidates.find(
          (c) => c.appointment.providerEventId === created.providerEventId,
        )?.appointment ?? null;
    }
  }

  if (!appointment || appointment.providerEventId !== created.providerEventId) {
    logStep("find_after_create_match", false, {
      message: "Could not resolve created event via findExistingAppointment",
      expectedProviderEventId: created.providerEventId,
      gotProviderEventId: appointment?.providerEventId ?? null,
    });
    process.exit(1);
  }
  logStep("find_after_create_match", true, {
    providerEventId: appointment.providerEventId,
    internalBookingId: appointment.internalBookingId,
  });

  const rescheduleStart = new Date(slot.start.getTime() + 60 * 60_000);
  const rescheduleEnd = new Date(slot.end.getTime() + 60 * 60_000);
  const summary = `${config.service.name} — ${CUSTOMER_NAME}`;

  const updated = await executeMicrosoftUpdateBooking(
    {
      connectionId: resolved.connectionId,
      providerEventId: appointment.providerEventId,
      providerCalendarId: appointment.providerCalendarId,
      startUtc: rescheduleStart.toISOString(),
      endUtc: rescheduleEnd.toISOString(),
      timezone: config.timezone,
      summary,
    },
    resolved.calendarConfig,
  );

  if (!updated.ok) {
    logStep("reschedule_appointment", false, updated);
    process.exit(1);
  }

  const rescheduleVerdict = await reconcileMicrosoftRescheduleOutcome({
    appointment,
    requestedStartUtc: rescheduleStart.toISOString(),
    requestedEndUtc: rescheduleEnd.toISOString(),
    config,
  });

  logStep("reschedule_appointment", rescheduleVerdict === "NEW_TIME", {
    update: updated,
    reconcile: rescheduleVerdict,
    requestedStartUtc: rescheduleStart.toISOString(),
    requestedEndUtc: rescheduleEnd.toISOString(),
  });

  if (rescheduleVerdict !== "NEW_TIME") {
    process.exit(1);
  }

  const appointmentRescheduled: ExistingAppointment = {
    ...appointment,
    startUtc: rescheduleStart.toISOString(),
    endUtc: rescheduleEnd.toISOString(),
  };

  await runFind(config, {
    label: "find_after_reschedule",
    dateExpression: slot.ymd,
    callId: `cert_find_rsc_${createId()}`,
  });

  const cancelled = await executeMicrosoftCancelBooking({
    request: {
      callId: `cert_cancel_${createId()}`,
      cancellationAttemptId: `cancel_${bookingAttemptId}`,
      providerEventId: appointmentRescheduled.providerEventId,
      providerCalendarId: appointmentRescheduled.providerCalendarId,
    },
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
  });

  if (!cancelled.ok) {
    logStep("cancel_appointment", false, cancelled);
    process.exit(1);
  }

  const cancelVerdict = await reconcileMicrosoftCancelOutcome({
    appointment: appointmentRescheduled,
    config,
  });

  logStep("cancel_appointment", cancelVerdict === "CANCELLED", {
    cancel: cancelled,
    reconcile: cancelVerdict,
  });

  if (cancelVerdict !== "CANCELLED") {
    process.exit(1);
  }

  const allOk = report.every((r) => r.ok);
  console.log(
    JSON.stringify({
      event: "LIVE_MS_APPT_CERT_DONE",
      ok: allOk,
      report,
    }),
  );
  if (!allOk) process.exit(1);
}

main().catch((err) => {
  console.error("LIVE_MS_APPT_CERT_FATAL", err);
  process.exit(1);
});
