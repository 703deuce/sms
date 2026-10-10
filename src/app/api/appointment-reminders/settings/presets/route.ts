import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import {
  applyReminderPresetBundle,
  listReminderPresetCatalog,
  type ReminderIndustryId,
  type ReminderLocaleCode,
  type ReminderTimingPresetId,
  type ReminderToneId,
} from "@/lib/appointment-reminders/reminder-presets";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments";

export async function GET() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    return NextResponse.json({ data: listReminderPresetCatalog() });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      industry?: ReminderIndustryId;
      tone?: ReminderToneId;
      timing?: ReminderTimingPresetId;
      cancellationPolicyId?: string;
      locale?: ReminderLocaleCode;
      apply?: boolean;
    };

    const current = await loadAppointmentPlatformConfig(auth.workspaceId);
    const next = applyReminderPresetBundle({
      config: current,
      industry: body.industry,
      tone: body.tone,
      timing: body.timing,
      cancellationPolicyId: body.cancellationPolicyId,
      locale: body.locale,
    });

    if (body.apply) {
      const data = await saveAppointmentPlatformConfig(auth.workspaceId, next);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ data: next });
  } catch (err) {
    return jsonError(err, 400);
  }
}
