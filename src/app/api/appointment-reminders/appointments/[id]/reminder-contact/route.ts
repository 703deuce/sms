import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { getAppointment } from "@/lib/appointments";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { isValidReminderPhone } from "@/lib/appointment-reminders/aggregate-reminder-status";

type Params = { params: Promise<{ id: string }> };

function normalizeToE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    return isValidReminderPhone(trimmed) ? trimmed : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.write");
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as { phone?: string };
    const e164 = body.phone ? normalizeToE164(body.phone) : null;
    if (!e164) {
      return NextResponse.json(
        { error: "Enter a valid phone number with country code." },
        { status: 400 },
      );
    }

    const prisma = getPrisma();
    const row = await prisma.voiceAppointment.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const meta = (row.metadata || {}) as AppointmentMetadata;
    const nextMeta: AppointmentMetadata = {
      ...meta,
      reminderOverride: {
        ...(meta.reminderOverride || {}),
        phone: e164,
      },
    };

    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: { metadata: nextMeta as object, updatedAt: new Date() },
    });

    const data = await getAppointment(auth.workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
