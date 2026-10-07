import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import {
  loadAppointmentPlatformConfig,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments/settings";
import type { AiReschedulerConfig } from "@/lib/appointment-reminders/ai-rescheduler/types";
import { resolveAiReschedulerConfig } from "@/lib/appointment-reminders/ai-rescheduler/types";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const config = resolveAiReschedulerConfig(platform);
    const connection = await getPrisma().voiceCalendarConnection.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        provider: { in: ["google", "microsoft"] },
        status: { in: ["connected", "needs_reauth"] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, provider: true, status: true, name: true },
    });
    return NextResponse.json({
      data: config,
      timezone: platform.timezone,
      calendar: connection
        ? {
            id: connection.id,
            provider: connection.provider,
            status: connection.status,
            label: connection.name || connection.provider,
          }
        : null,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Partial<AiReschedulerConfig>;
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const current = resolveAiReschedulerConfig(platform);
    const next: AiReschedulerConfig = {
      ...current,
      ...body,
      weeklyHours: body.weeklyHours
        ? { ...current.weeklyHours, ...body.weeklyHours }
        : current.weeklyHours,
    };
    const data = await saveAppointmentPlatformConfig(auth.workspaceId, {
      aiRescheduler: next,
    });
    return NextResponse.json({ data: resolveAiReschedulerConfig(data) });
  } catch (err) {
    return jsonError(err, 400);
  }
}
