import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { listAppointmentRemindersCalendarEvents } from "@/lib/appointment-reminders/calendar/list-calendar-events";
import { maybeSyncStaleAppointmentRemindersCalendars } from "@/lib/appointment-reminders/calendar/maybe-sync-stale-calendars";
import { ensureMicrosoftCalendarSubscriptionsForWorkspace } from "@/lib/calendar/ensure-microsoft-subscriptions";

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    if (!fromRaw || !toRaw) {
      return NextResponse.json({ error: "from and to are required (ISO)" }, { status: 400 });
    }
    const from = new Date(fromRaw);
    const to = new Date(toRaw);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid from or to" }, { status: 400 });
    }

    void ensureMicrosoftCalendarSubscriptionsForWorkspace(auth.workspaceId).catch(() => undefined);

    const refresh = searchParams.get("refresh") === "1";
    let syncMeta: { ran: boolean } | undefined;
    if (refresh) {
      const sync = await maybeSyncStaleAppointmentRemindersCalendars(auth.workspaceId);
      syncMeta = { ran: sync.ran };
    } else {
      void maybeSyncStaleAppointmentRemindersCalendars(auth.workspaceId).catch(() => {});
    }

    const staffRaw = searchParams.get("staffIds");
    const staffIds = staffRaw
      ? staffRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    const data = await listAppointmentRemindersCalendarEvents(auth.workspaceId, {
      from,
      to,
      q: searchParams.get("q") || undefined,
      status: searchParams.get("status") || undefined,
      staffIds,
      locationId: searchParams.get("locationId") || undefined,
      resourceId: searchParams.get("resourceId") || undefined,
      domainType: searchParams.get("domainType") || undefined,
    });

    return NextResponse.json({
      data,
      meta: {
        from: from.toISOString(),
        to: to.toISOString(),
        count: data.length,
        sync: syncMeta,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
