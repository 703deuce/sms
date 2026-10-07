import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";
import {
  BOOKING_TYPE_KINDS,
  defaultConfigPatchForKind,
  type BookingTypeKind,
} from "@/lib/appointments/booking-type-kind";
import { listAppointmentTypes, upsertAppointmentType } from "@/lib/appointments";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";

function isSimpleBookingType(config?: AppointmentTypeConfig | null): boolean {
  const kind = resolveBookingTypeKind(config ?? undefined);
  return kind === "MEETING" || kind === "SERVICE";
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      name?: string;
      durationMinutes?: number;
      bookingTypeKind?: BookingTypeKind;
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const kind =
      body.bookingTypeKind && BOOKING_TYPE_KINDS.includes(body.bookingTypeKind)
        ? body.bookingTypeKind
        : "SERVICE";

    const durationMinutes =
      typeof body.durationMinutes === "number" && body.durationMinutes > 0
        ? Math.min(480, Math.round(body.durationMinutes))
        : 30;

    const config: AppointmentTypeConfig = {
      ...defaultConfigPatchForKind(kind),
      enabled: true,
      visibility: "public",
      staffAssignment: "any_eligible",
      description: "",
    };

    const row = await upsertAppointmentType(auth.workspaceId, {
      name,
      durationMinutes,
      bufferMinutes: 0,
      config,
    });

    const types = (await listAppointmentTypes(auth.workspaceId, { includeSecret: true, includeUnlisted: true }))
      .filter((t) => isSimpleBookingType(t.config))
      .map((t) => ({
        id: t.id,
        name: t.name,
        durationMinutes: t.durationMinutes,
        config: t.config,
      }));

    return NextResponse.json(
      {
        data: {
          created: {
            id: row.id,
            name: row.name,
            durationMinutes: row.durationMinutes,
          },
          types,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err, 400);
  }
}
