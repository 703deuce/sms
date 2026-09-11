import {
  listClassSeries,
  upsertClassSeries,
  generateClassOccurrences,
  listOccurrencesForSeries,
  cancelClassOccurrence,
  updateClassOccurrence,
  enrollInClass,
  purchaseAndEnrollClassSeries,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => listClassSeries(workspaceId));
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    switch (body.action) {
      case "list_occurrences":
        return listOccurrencesForSeries(workspaceId, body.seriesId);
      case "occurrences":
        return generateClassOccurrences(workspaceId, body.seriesId, body.occurrences);
      case "cancel_occurrence":
        return cancelClassOccurrence(workspaceId, body.occurrenceId);
      case "update_occurrence":
        return updateClassOccurrence(workspaceId, body.occurrenceId, body);
      case "enroll":
        return enrollInClass(workspaceId, body);
      case "purchase_enroll":
        return purchaseAndEnrollClassSeries(workspaceId, body.contactId, body.seriesId, body.packageProductId);
      default:
        return upsertClassSeries(workspaceId, body);
    }
  });
}
