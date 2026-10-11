import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import {
  loadAppointmentPlatformConfig,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments/settings";
import { getAppointmentRemindersWorkspaceConfig } from "@/lib/appointment-reminders/workspace-existing-sms-consent";

export async function POST() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const current = getAppointmentRemindersWorkspaceConfig(platform);
    const data = await saveAppointmentPlatformConfig(auth.workspaceId, {
      appointmentReminders: {
        ...current,
        setupConfigureCompletedAt: new Date().toISOString(),
      },
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
