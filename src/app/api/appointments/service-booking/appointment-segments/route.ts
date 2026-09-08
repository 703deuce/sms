import {
  APPOINTMENT_SEGMENT_PRESETS,
  resolveAppointmentSegment,
  type AppointmentSegmentPreset,
} from "@/lib/appointments/appointment-segments";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const preset = url.searchParams.get("preset") as AppointmentSegmentPreset | null;
  const bookingTypeId = url.searchParams.get("bookingTypeId") || undefined;
  const bookingTypeName = url.searchParams.get("bookingTypeName") || undefined;

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (!preset) {
      return { presets: APPOINTMENT_SEGMENT_PRESETS };
    }
    const contacts = await resolveAppointmentSegment(workspaceId, preset, {
      bookingTypeId,
      bookingTypeName,
    });
    return { preset, count: contacts.length, contacts };
  });
}
