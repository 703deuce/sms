/**
 * Production: verify appointment + Microsoft Graph event after SMS reschedule.
 *
 *   npx tsx scripts/ar-prod-verify-reschedule.ts --appointment-id <id>
 */
import { getPrisma } from "../src/lib/db";
import { providerRefFromAppointment } from "../src/lib/appointment-reminders/ai-rescheduler/provider-mutations";
import { getValidAccessToken, type CalendarConfig } from "../src/lib/calendar/providers";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const appointmentId = arg("--appointment-id") || process.env.APPT_ID;
  if (!appointmentId) {
    console.error("Usage: --appointment-id <voiceAppointment id>");
    process.exit(1);
  }

  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({ where: { id: appointmentId } });
  if (!row) {
    console.error("appointment_not_found", appointmentId);
    process.exit(1);
  }

  const ref = providerRefFromAppointment(row);
  console.log("local_appointment", {
    id: row.id,
    workspaceId: row.workspaceId,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    timezone: row.timezone,
    externalId: row.externalId,
    providerRef: ref,
  });

  const session = await prisma.arSmsReplySession.findFirst({
    where: { appointmentId: row.id },
    orderBy: { lastUsedAt: "desc" },
  });
  if (session) {
    console.log("ar_reply_session", {
      id: session.id,
      lifecycleState: session.lifecycleState,
      lastUsedAt: session.lastUsedAt?.toISOString(),
      hasWorkflowState: Boolean(session.rescheduleWorkflowState),
    });
  }

  if (!ref || ref.provider !== "microsoft") {
    console.log("graph_skipped", "no_microsoft_provider_ref");
    return;
  }

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: ref.connectionId, workspaceId: row.workspaceId },
  });
  if (!conn) {
    console.error("connection_not_found", ref.connectionId);
    process.exit(1);
  }

  const calendarConfig = (conn.config || {}) as CalendarConfig;
  const token = await getValidAccessToken(ref.connectionId, "microsoft", calendarConfig);
  if (!token) {
    console.error("graph_token_missing");
    process.exit(1);
  }

  const calId = ref.providerCalendarId || calendarConfig.writeCalendarId || "";
  const url = `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(ref.providerEventId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json().catch(() => ({}))) as {
    start?: { dateTime?: string; timeZone?: string };
    end?: { dateTime?: string; timeZone?: string };
    subject?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    console.error("graph_event_fetch_failed", res.status, json.error?.message || json);
    process.exit(1);
  }

  console.log("microsoft_graph_event", {
    subject: json.subject,
    start: json.start,
    end: json.end,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
