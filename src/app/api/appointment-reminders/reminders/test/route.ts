import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { getPrisma } from "@/lib/db";
import {
  getAppointment,
  loadAppointmentPlatformConfig,
  previewReminderMessage,
  sendTestReminderSms,
  sendTestReminderEmail,
} from "@/lib/appointments";
import { hasWorkspaceExistingCustomerSmsConsent } from "@/lib/appointment-reminders/workspace-existing-sms-consent";
import { analyzeSmsBody } from "@/lib/mctb/sms-channel";
import { reminderAppointmentMergeVars } from "@/lib/appointment-reminders/template-library/merge-context";
import { renderAppointmentTemplate } from "@/lib/appointments/appointments-service";
import { resolveReminderStep } from "@/lib/appointments/reminders/reminders-config";
import type { AppointmentMetadata } from "@/lib/appointments/types";

const TEST_COOLDOWN_MS = 60_000;
const testSmsLastSent = new Map<string, number>();

function rateLimitTestSms(workspaceId: string): string | null {
  const key = workspaceId;
  const last = testSmsLastSent.get(key) || 0;
  if (Date.now() - last < TEST_COOLDOWN_MS) {
    return "Wait a minute before sending another test SMS.";
  }
  testSmsLastSent.set(key, Date.now());
  return null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.test");
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const stepKey = searchParams.get("step") || "confirmation";
    const appointmentId = searchParams.get("appointmentId");
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const ws = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { displayName: true, name: true },
    });
    const step = resolveReminderStep(platform, stepKey);
    if (!step) {
      return NextResponse.json({ error: "Unknown reminder step" }, { status: 404 });
    }
    const businessName = ws?.displayName || ws?.name || "Business";
    if (appointmentId) {
      const appt = await getAppointment(auth.workspaceId, appointmentId);
      if (!appt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      const meta = (appt.metadata || {}) as AppointmentMetadata;
      const vars = reminderAppointmentMergeVars({
        platform,
        metadata: meta,
        businessName,
        service: appt.serviceName,
        staffName: appt.staffName,
        startsAt: appt.startsAt,
        endsAt: appt.endsAt,
        timezone: appt.timezone || platform.timezone,
      });
      const preview = renderAppointmentTemplate(step.template, vars);
      const segments = Math.max(1, analyzeSmsBody(preview).segmentCount);
      return NextResponse.json({
        data: { preview, stepKey, appointmentId, smsSegments: segments, encoding: analyzeSmsBody(preview).encoding },
      });
    }
    const preview = previewReminderMessage({
      step,
      platform,
      workspaceName: businessName,
    });
    const segments = Math.max(1, analyzeSmsBody(preview).segmentCount);
    return NextResponse.json({ data: { preview, stepKey, smsSegments: segments } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.test");
    if ("error" in auth) return auth.error;
    const limited = rateLimitTestSms(auth.workspaceId);
    if (limited) {
      return NextResponse.json({ error: limited }, { status: 429 });
    }
    const body = (await request.json()) as { stepKey?: string; phone?: string; email?: string };
    const stepKey = body.stepKey || "confirmation";
    if (body.email?.trim()) {
      const result = await sendTestReminderEmail(auth.workspaceId, {
        stepKey,
        email: body.email.trim(),
      });
      return NextResponse.json({ data: result });
    }
    if (!body.phone?.trim()) {
      return NextResponse.json({ error: "phone or email is required" }, { status: 400 });
    }
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    if (
      stepKey !== "confirmation" &&
      !hasWorkspaceExistingCustomerSmsConsent(platform)
    ) {
      return NextResponse.json(
        {
          error:
            "Certify existing customer SMS permission in Setup before sending test reminder texts.",
        },
        { status: 403 },
      );
    }
    const result = await sendTestReminderSms(auth.workspaceId, {
      stepKey,
      phone: body.phone.trim(),
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
