import "server-only";

import type { MeetingPoll } from "@/lib/appointments/scheduling-capabilities";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import { listAppointmentTypes } from "@/lib/appointments/booking-platform";

type AppointmentTypeRow = {
  id: string;
  name: string;
  durationMinutes: number;
  config?: AppointmentTypeConfig;
};
import {
  assertEventTypeAccess,
  assertAppointmentPermission,
  filterEventTypesForUser,
} from "@/lib/appointments/org-permissions";

export async function assertPollManageAccess(
  workspaceId: string,
  userId: string,
  email: string | undefined,
  poll: MeetingPoll,
): Promise<void> {
  await assertAppointmentPermission(workspaceId, userId, "appointments.read", email);
  if (poll.appointmentTypeId) {
    const types = await listAppointmentTypes(workspaceId);
    const type = (types as AppointmentTypeRow[]).find((t) => t.id === poll.appointmentTypeId);
    if (!type) throw new Error("Linked meeting type not found");
    await assertEventTypeAccess(workspaceId, userId, email, type.config || {}, "edit");
    return;
  }
  await assertAppointmentPermission(workspaceId, userId, "appointments.book", email);
}

export async function filterMeetingPollsForUser(
  workspaceId: string,
  userId: string,
  email: string | undefined,
  polls: MeetingPoll[],
): Promise<MeetingPoll[]> {
  const types = (await listAppointmentTypes(workspaceId)) as AppointmentTypeRow[];
  const editableTypes = await filterEventTypesForUser(
    workspaceId,
    userId,
    email,
    types,
    "edit",
  );
  const editableIds = new Set((editableTypes as AppointmentTypeRow[]).map((t) => t.id));
  return polls.filter((poll) => {
    if (!poll.appointmentTypeId) return true;
    return editableIds.has(poll.appointmentTypeId);
  });
}

export async function filterMeetingTypesForPollCreation(
  workspaceId: string,
  userId: string,
  email: string | undefined,
) {
  const types = (await listAppointmentTypes(workspaceId)) as AppointmentTypeRow[];
  const bookable = (await filterEventTypesForUser(
    workspaceId,
    userId,
    email,
    types,
    "book",
  )) as AppointmentTypeRow[];
  return bookable.filter((t) => t.config?.bookingTypeKind === "MEETING");
}
