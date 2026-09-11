import {
  assertSeriesKind,
  countSeriesRegistrations,
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
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";
import { metadataForOfferingKind } from "@/lib/appointments/class-series-offering";

/**
 * Workshops are stored as ClassSeries rows carrying `metadata.kind =
 * "workshop"`. This route exists rather than reusing the classes route so the
 * kind is enforced on the server for every read and every write: a request
 * that names a class id gets "Workshop not found", not somebody else's class.
 */
const KIND = "workshop" as const;

export async function GET(request: Request) {
  const seriesId = new URL(request.url).searchParams.get("seriesId");
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (seriesId) return getClassSeries(workspaceId, seriesId, KIND);
    const rows = await listClassSeries(workspaceId, KIND);
    // The list row states how full a workshop is, and a workshop is full
    // across the whole event, so the count comes from the series.
    const counts = await countSeriesRegistrations(
      workspaceId,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({ ...row, registeredCount: counts.get(row.id) ?? 0 }));
  });
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
      default: {
        // An update has to prove it owns a workshop before it writes; a create
        // has nothing to check yet. Either way the stored kind is set here and
        // not taken from the request, so this route cannot mint a class.
        if (body.id) await assertSeriesKind(workspaceId, KIND, { seriesId: body.id });
        return upsertClassSeries(workspaceId, {
          ...body,
          metadata: metadataForOfferingKind(KIND, body.metadata || {}),
        });
      }
    }
  });
}
