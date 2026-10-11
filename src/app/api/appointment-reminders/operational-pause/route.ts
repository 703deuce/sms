import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import {
  loadAppointmentPlatformConfig,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments/settings";
import type { ArOperationalPauseState } from "@/lib/appointment-reminders/ar-operational-pause";
import { isArRemindersPaused } from "@/lib/appointment-reminders/ar-operational-pause";

export async function GET() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const pause = platform.appointmentReminders?.operationalPause ?? null;
    return NextResponse.json({
      data: {
        paused: isArRemindersPaused(platform),
        pause,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action: "pause" | "resume";
      pausedUntil?: string | null;
      indefinite?: boolean;
      reason?: string;
    };

    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const current = platform.appointmentReminders || {};

    if (body.action === "resume") {
      const data = await saveAppointmentPlatformConfig(auth.workspaceId, {
        appointmentReminders: {
          ...current,
          operationalPause: null,
        },
      });
      return NextResponse.json({ data: { paused: false, pause: null, platform: data } });
    }

    if (body.action !== "pause") {
      return NextResponse.json({ error: "action must be pause or resume" }, { status: 400 });
    }

    const pause: ArOperationalPauseState = {
      pausedAt: new Date().toISOString(),
      pausedByUserId: auth.session.userId,
      pausedUntil: body.indefinite ? null : body.pausedUntil ?? null,
      indefinite: Boolean(body.indefinite),
      reason: body.reason?.trim() || null,
    };

    const data = await saveAppointmentPlatformConfig(auth.workspaceId, {
      appointmentReminders: {
        ...current,
        operationalPause: pause,
      },
    });
    return NextResponse.json({
      data: { paused: isArRemindersPaused(data), pause, platform: data },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
