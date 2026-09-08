import {
  listSeatMaps,
  upsertSeatMap,
  reserveSeat,
  releaseSeat,
  getSeatMapWithAvailability,
} from "@/lib/appointments/service-booking/phase2";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const seatMapId = url.searchParams.get("seatMapId");

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (seatMapId) {
      return getSeatMapWithAvailability(workspaceId, seatMapId);
    }
    return listSeatMaps(workspaceId, {
      occurrenceId: url.searchParams.get("occurrenceId") || undefined,
      seriesId: url.searchParams.get("seriesId") || undefined,
    });
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    switch (body.action) {
      case "reserve":
        return reserveSeat(workspaceId, body.seatMapId, body);
      case "release":
        return releaseSeat(workspaceId, body.reservationId);
      default:
        return upsertSeatMap(workspaceId, body);
    }
  });
}
