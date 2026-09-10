import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listAppointmentTypes, type ListedAppointmentType } from "@/lib/appointments/booking-platform";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const [platform, types] = await Promise.all([
      loadAppointmentPlatformConfig(auth.workspaceId),
      listAppointmentTypes(auth.workspaceId, { includeSecret: true, includeUnlisted: true }),
    ]);

    return NextResponse.json({
      data: {
        calendarColors: platform.calendarColors || {},
        staff: (platform.staff || [])
          .filter((s) => s.active !== false)
          .map((s) => ({ id: s.id, name: s.name })),
        locations: (platform.locations || [])
          .filter((l) => l.active !== false)
          .map((l) => ({ id: l.id, name: l.name })),
        bookingTypes: types
          .filter((t: ListedAppointmentType) => t.active)
          .map((t: ListedAppointmentType) => ({
            id: t.id,
            name: t.name,
            kind: t.config.bookingTypeKind || "SERVICE",
            calendarColor: t.config.calendarColor || null,
          })),
        waitlistAutoFill: platform.waitlistAutoFill !== false,
        waitlistNotifyOnOpening: platform.waitlistNotifyOnOpening !== false,
        waitlistOfferExpirationMinutes: platform.waitlistOfferExpirationMinutes ?? 30,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
