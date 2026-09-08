import {
  createClassCheckIn,
  checkInByToken,
  listClassCheckIns,
  getClassCheckInQrPayload,
} from "@/lib/appointments/service-booking/phase2";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const checkInId = url.searchParams.get("checkInId");

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (checkInId) {
      return getClassCheckInQrPayload(workspaceId, checkInId);
    }
    return listClassCheckIns(workspaceId, {
      occurrenceId: url.searchParams.get("occurrenceId") || undefined,
      contactId: url.searchParams.get("contactId") || undefined,
    });
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    if (body.action === "check_in") {
      return checkInByToken(body.token);
    }
    return createClassCheckIn(workspaceId, body);
  });
}
