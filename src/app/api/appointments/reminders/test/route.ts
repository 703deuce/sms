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
    const stepKey = (searchParams.get("step") || "confirmation") as
      | "confirmation"
      | "reminder24h"
      | "reminder2h";
    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    const ws = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { displayName: true, name: true },
    });
    const step = platform.reminders[stepKey];
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
      stepKey?: "confirmation" | "reminder24h" | "reminder2h";
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
