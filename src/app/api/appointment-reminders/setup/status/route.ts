import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import {
  evaluateAppointmentRemindersSetupReadiness,
  loadAppointmentRemindersActivation,
  saveAppointmentRemindersActivation,
} from "@/lib/appointment-reminders/activation";

export async function GET() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;
    const { ensureAppointmentRemindersCalendarsSynced } = await import(
      "@/lib/appointment-reminders/calendar/ensure-calendars-synced"
    );
    await ensureAppointmentRemindersCalendarsSynced(auth.workspaceId, { awaitInitial: true });
    const [readiness, activation] = await Promise.all([
      evaluateAppointmentRemindersSetupReadiness(auth.workspaceId),
      loadAppointmentRemindersActivation(auth.workspaceId),
    ]);
    return NextResponse.json({ data: { readiness, activation } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const readiness = await evaluateAppointmentRemindersSetupReadiness(auth.workspaceId);
    if (!readiness.canActivate) {
      return NextResponse.json(
        { error: "Setup incomplete", blockers: readiness.blockers },
        { status: 400 },
      );
    }
    const activation = await saveAppointmentRemindersActivation(auth.workspaceId, {
      activatedAt: new Date().toISOString(),
      activatedByUserId: auth.session.userId,
    });
    return NextResponse.json({ data: { activation, readiness: { ...readiness, activated: true } } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
