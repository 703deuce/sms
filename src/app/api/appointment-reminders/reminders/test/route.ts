import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { getPrisma } from "@/lib/db";
import {
  loadAppointmentPlatformConfig,
  previewReminderMessage,
  sendTestReminderSms,
  sendTestReminderEmail,
} from "@/lib/appointments";

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
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const ws = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { displayName: true, name: true },
    });
    const { resolveReminderStep } = await import("@/lib/appointments/reminders/reminders-config");
    const step = resolveReminderStep(platform, stepKey);
    if (!step) {
      return NextResponse.json({ error: "Unknown reminder step" }, { status: 404 });
    }
    const preview = previewReminderMessage({
      step,
      platform,
      workspaceName: ws?.displayName || ws?.name || "Business",
    });
    return NextResponse.json({ data: { preview, stepKey } });
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
    const result = await sendTestReminderSms(auth.workspaceId, {
      stepKey,
      phone: body.phone.trim(),
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
