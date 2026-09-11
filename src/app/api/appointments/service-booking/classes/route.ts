import {
  listClassSeries,
  getClassSeries,
  upsertClassSeries,
  deleteClassSeries,
  generateClassOccurrences,
  listOccurrencesForSeries,
  cancelClassOccurrence,
  updateClassOccurrence,
  listClassRegistrants,
  updateClassEnrollment,
  listClassWaitlist,
  joinClassWaitlist,
  promoteClassWaitlistEntry,
  removeClassWaitlistEntry,
  enrollInClass,
  purchaseAndEnrollClassSeries,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const seriesId = new URL(request.url).searchParams.get("seriesId");
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    seriesId ? getClassSeries(workspaceId, seriesId) : listClassSeries(workspaceId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const readActions = new Set(["list_occurrences", "list_registrants", "list_waitlist"]);
  const scope = readActions.has(body.action) ? "appointments.read" : "appointments.write";

  return withAppointmentsAuth(scope, async ({ workspaceId }) => {
    switch (body.action) {
      case "list_occurrences":
        return listOccurrencesForSeries(workspaceId, body.seriesId);
      case "list_registrants":
        return listClassRegistrants(workspaceId, {
          seriesId: body.seriesId,
          occurrenceId: body.occurrenceId,
        });
      case "list_waitlist":
        return listClassWaitlist(workspaceId, {
          seriesId: body.seriesId,
          occurrenceId: body.occurrenceId,
        });
      case "occurrences":
        return generateClassOccurrences(workspaceId, body.seriesId, body.occurrences);
      case "cancel_occurrence":
        return cancelClassOccurrence(workspaceId, body.occurrenceId);
      case "update_occurrence":
        return updateClassOccurrence(workspaceId, body.occurrenceId, body);
      case "update_enrollment":
        return updateClassEnrollment(workspaceId, body.enrollmentId, {
          status: body.status,
          attendance: body.attendance,
        });
      case "join_waitlist":
        return joinClassWaitlist(workspaceId, {
          seriesId: body.seriesId,
          occurrenceId: body.occurrenceId,
          contactId: body.contactId,
        });
      case "promote_waitlist":
        return promoteClassWaitlistEntry(workspaceId, body.entryId, body.occurrenceId);
      case "remove_waitlist":
        return removeClassWaitlistEntry(workspaceId, body.entryId);
      case "delete":
        return deleteClassSeries(workspaceId, body.seriesId);
      case "enroll":
        return enrollInClass(workspaceId, body);
      case "purchase_enroll":
        return purchaseAndEnrollClassSeries(
          workspaceId,
          body.contactId,
          body.seriesId,
          body.packageProductId,
        );
      default:
        return upsertClassSeries(workspaceId, body);
    }
  });
}
