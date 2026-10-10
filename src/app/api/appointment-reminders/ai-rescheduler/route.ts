import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import {
  loadAppointmentPlatformConfig,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments/settings";
import {
  resolveAiReschedulerConfig,
  type AiReschedulerConfig,
} from "@/lib/appointment-reminders/ai-rescheduler/types";
import { getPrisma } from "@/lib/db";
import { evaluateArCalendarReadiness } from "@/lib/appointment-reminders/ai-rescheduler/calendar-readiness";
import type { CalendarConfig } from "@/lib/voice/calendar/providers";

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
    const fullConn = connection
      ? await getPrisma().voiceCalendarConnection.findFirst({
          where: { id: connection.id, workspaceId: auth.workspaceId },
          select: { config: true },
        })
      : null;
    const readiness = evaluateArCalendarReadiness({
      provider: connection?.provider,
      connectionStatus: connection?.status,
      config: (fullConn?.config || {}) as CalendarConfig,
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
      readiness,
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
    const mode =
      body.mode === "reminders_only" || body.mode === "notify" || body.mode === "ai"
        ? body.mode
        : current.mode;
    const { assertAiReschedulerModeAllowed, ArFeatureGateError } = await import(
      "@/lib/appointment-reminders/commercial/ar-feature-gates"
    );
    try {
      await assertAiReschedulerModeAllowed(auth.workspaceId, mode);
    } catch (err) {
      if (err instanceof ArFeatureGateError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 403 });
      }
      throw err;
    }

    const next: AiReschedulerConfig = {
      ...current,
      ...body,
      mode,
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
