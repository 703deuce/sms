import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listAppointmentTypes, type ListedAppointmentType } from "@/lib/appointments/booking-platform";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const types = await listAppointmentTypes(auth.workspaceId, {
      includeSecret: true,
      includeUnlisted: true,
    });

    return NextResponse.json({
      data: {
        bookingTypes: types
          .filter((t: ListedAppointmentType) => t.active)
          .map((t: ListedAppointmentType) => ({ id: t.id, name: t.name })),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
