import {
  assertSeriesKind,
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
import { metadataForOfferingKind } from "@/lib/appointments/class-series-offering";

/**
 * Classes and workshops share the ClassSeries table, so this route pins itself
 * to the class kind the same way the workshops route pins itself to its own.
 * Neither page can read or write the other's rows by id.
 */
const KIND = "class" as const;

export async function GET(request: Request) {
  const seriesId = new URL(request.url).searchParams.get("seriesId");
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    seriesId ? getClassSeries(workspaceId, seriesId, KIND) : listClassSeries(workspaceId, KIND),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const readActions = new Set(["list_occurrences", "list_registrants", "list_waitlist"]);
  const scope = readActions.has(body.action) ? "appointments.read" : "appointments.write";

  return withAppointmentsAuth(scope, async ({ workspaceId }) => {
    const guard = () =>
      assertSeriesKind(workspaceId, KIND, {
        seriesId: body.seriesId,
        occurrenceId: body.occurrenceId,
        enrollmentId: body.enrollmentId,
        entryId: body.entryId,
      });

    switch (body.action) {
      case "list_occurrences":
        await guard();
        return listOccurrencesForSeries(workspaceId, body.seriesId);
      case "list_registrants":
        await guard();
        return listClassRegistrants(workspaceId, {
          seriesId: body.seriesId,
          occurrenceId: body.occurrenceId,
        });
      case "list_waitlist":
        await guard();
        return listClassWaitlist(workspaceId, {
          seriesId: body.seriesId,
          occurrenceId: body.occurrenceId,
        });
      case "occurrences":
        await guard();
        return generateClassOccurrences(workspaceId, body.seriesId, body.occurrences);
      case "cancel_occurrence":
        await guard();
        return cancelClassOccurrence(workspaceId, body.occurrenceId);
      case "update_occurrence":
        await guard();
        return updateClassOccurrence(workspaceId, body.occurrenceId, body);
      case "update_enrollment":
        await guard();
        return updateClassEnrollment(workspaceId, body.enrollmentId, {
          status: body.status,
          attendance: body.attendance,
        });
      case "join_waitlist":
        await guard();
        return joinClassWaitlist(workspaceId, {
          seriesId: body.seriesId,
          occurrenceId: body.occurrenceId,
          contactId: body.contactId,
        });
      case "promote_waitlist":
        await guard();
        return promoteClassWaitlistEntry(workspaceId, body.entryId, body.occurrenceId);
      case "remove_waitlist":
        await guard();
        return removeClassWaitlistEntry(workspaceId, body.entryId);
      case "delete":
        return deleteClassSeries(workspaceId, body.seriesId, KIND);
      case "enroll":
        await guard();
        return enrollInClass(workspaceId, body);
      case "purchase_enroll":
        await guard();
        return purchaseAndEnrollClassSeries(
          workspaceId,
          body.contactId,
          body.seriesId,
          body.packageProductId,
        );
      default: {
        if (body.id) await assertSeriesKind(workspaceId, KIND, { seriesId: body.id });
        return upsertClassSeries(workspaceId, {
          ...body,
          metadata: metadataForOfferingKind(KIND, body.metadata || {}),
        });
      }
    }
  });
}
