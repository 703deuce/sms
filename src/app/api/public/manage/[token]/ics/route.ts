import { NextResponse } from "next/server";
import { resolveManageAppointmentByToken } from "@/lib/appointments/service-booking";
import { buildIcsAttachment } from "@/lib/appointments/ics-builder";
import { resolveManageLinkFromMetadata } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveManageAppointmentByToken(token);
    if (!resolved) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    }

    const appt = resolved.appointment;
    const meta = (appt.metadata || {}) as AppointmentMetadata;
    const endsAt =
      appt.endsAt ||
      new Date(appt.startsAt.getTime() + Number(meta.durationMinutes || 60) * 60_000);
    const manageUrl = resolveManageLinkFromMetadata(meta, token);
    const location =
      typeof meta.location === "string" && !meta.location.startsWith("http")
        ? meta.location
        : meta.locationKind === "transovo_video"
          ? "Transovo Video"
          : undefined;

    const ws = await import("@/lib/db").then((m) =>
      m.getPrisma().workspace.findUnique({
        where: { id: resolved.token.workspaceId },
        select: { displayName: true, name: true },
      }),
    );

    const ics = buildIcsAttachment({
      summary: appt.serviceName || "Appointment",
      startsAt: appt.startsAt,
      endsAt,
      timezone: appt.timezone || "UTC",
      organizerName: ws?.displayName || ws?.name || "Transovo",
      location,
      manageUrl: manageUrl || undefined,
      uid: `appointment-${appt.id}@transovo.ai`,
    });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="appointment.ics"',
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate calendar file";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
