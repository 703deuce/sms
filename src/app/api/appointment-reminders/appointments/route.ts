import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { loadAppointmentRemindersPage } from "@/lib/appointment-reminders/load-appointments-page";
import { createManualArAppointment } from "@/lib/appointment-reminders/ar-manual-appointments";
import { loadAppointmentPlatformConfig } from "@/lib/appointments";

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;
    const { scheduleAppointmentRemindersCalendarSync } = await import(
      "@/lib/appointment-reminders/calendar/ensure-calendars-synced"
    );
    scheduleAppointmentRemindersCalendarSync(auth.workspaceId);
    const { searchParams } = new URL(request.url);
    const data = await loadAppointmentRemindersPage(auth.workspaceId, {
      q: searchParams.get("q") || undefined,
      date: searchParams.get("date") || "upcoming",
      reminderStatus: searchParams.get("reminderStatus") || "all",
      engagement: searchParams.get("engagement") || "all",
      calendarId: searchParams.get("calendarId") || "all",
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : 25,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.write");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      inviteeName?: string;
      inviteeEmail?: string;
      inviteePhone?: string;
      serviceName?: string;
      startsAt?: string;
      endsAt?: string;
      timezone?: string;
      staffName?: string;
      location?: string;
      notes?: string;
    };
    if (!body.inviteeName?.trim()) {
      return NextResponse.json({ error: "inviteeName is required" }, { status: 400 });
    }
    if (!body.startsAt) {
      return NextResponse.json({ error: "startsAt is required" }, { status: 400 });
    }
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const row = await createManualArAppointment(auth.workspaceId, {
      inviteeName: body.inviteeName.trim(),
      inviteeEmail: body.inviteeEmail,
      inviteePhone: body.inviteePhone,
      serviceName: body.serviceName,
      startsAt: new Date(body.startsAt),
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      timezone: body.timezone || platform.timezone,
      staffName: body.staffName,
      location: body.location,
      notes: body.notes,
    });
    return NextResponse.json({ data: { id: row.id } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
