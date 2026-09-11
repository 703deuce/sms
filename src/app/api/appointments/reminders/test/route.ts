import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  loadAppointmentPlatformConfig,
  previewReminderMessage,
  sendTestReminderSms,
} from "@/lib/appointments";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
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
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      stepKey?: string;
      phone?: string;
    };
    if (!body.phone?.trim()) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }
    const stepKey = body.stepKey || "confirmation";
    const result = await sendTestReminderSms(auth.workspaceId, {
      stepKey,
      phone: body.phone.trim(),
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
