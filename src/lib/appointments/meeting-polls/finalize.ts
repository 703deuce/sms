import "server-only";

import { createPlatformAppointment } from "@/lib/appointments/booking-platform";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { filterStaffAvailableForSlot } from "@/lib/appointments/staff-availability";
import type { AppointmentTypeConfig, BookableStaffMember } from "@/lib/appointments/types";
import type { MeetingPoll } from "@/lib/appointments/scheduling-capabilities";
import { getPrisma } from "@/lib/db";
import { appendPollActivity, touchPoll } from "./model";

export type FinalizePollInput = {
  workspaceId: string;
  poll: MeetingPoll;
  optionId: string;
  idempotencyKey: string;
  organizerStaffId?: string;
  forceDespiteConflicts?: boolean;
};

export type FinalizePollResult =
  | { ok: true; appointmentId: string; poll: MeetingPoll }
  | { ok: false; code: "already_finalized" | "invalid_option" | "past_option" | "organizer_busy" | "conflict"; message: string; appointmentId?: string };

export async function finalizeMeetingPoll(input: FinalizePollInput): Promise<FinalizePollResult> {
  const poll = input.poll;
  if (poll.status === "finalized" && poll.bookedAppointmentId) {
    return {
      ok: false,
      code: "already_finalized",
      message: "This poll was already finalized.",
      appointmentId: poll.bookedAppointmentId,
    };
  }
  if (poll.finalizeIdempotencyKey === input.idempotencyKey && poll.bookedAppointmentId) {
    return { ok: true, appointmentId: poll.bookedAppointmentId, poll };
  }

  const option = poll.options.find((o) => o.id === input.optionId && !o.archivedAt);
  if (!option) {
    return { ok: false, code: "invalid_option", message: "Selected time option is not available." };
  }
  if (new Date(option.endsAt).getTime() < Date.now()) {
    return { ok: false, code: "past_option", message: "Cannot finalize a time that has already passed." };
  }

  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const staff: BookableStaffMember[] = platform.staff || [];
  const organizerStaffId = input.organizerStaffId || poll.organizerStaffId;
  const organizer = staff.find((s) => s.id === organizerStaffId) || staff.find((s) => s.active) || staff[0];

  let svcCfg: AppointmentTypeConfig = {};
  let serviceName = poll.title;
  let serviceId = poll.appointmentTypeId;
  const prisma = getPrisma();
  if (serviceId) {
    const svc = await prisma.voiceService.findFirst({
      where: { id: serviceId, workspaceId: input.workspaceId },
    });
    if (svc) {
      serviceName = svc.name;
      svcCfg = (svc.config || {}) as AppointmentTypeConfig;
    }
  }

  const startsAt = new Date(option.startsAt);
  const endsAt = new Date(option.endsAt);
  const timezone = poll.timezone || platform.timezone || "America/New_York";

  if (organizer && poll.settings.requireOrganizerFreeOnFinalize && !input.forceDespiteConflicts) {
    const available = await filterStaffAvailableForSlot(
      input.workspaceId,
      [organizer],
      startsAt,
      endsAt,
      {
        timezone,
        durationMinutes: poll.durationMinutes,
        bufferBeforeMs: (svcCfg.bufferBeforeMinutes || 0) * 60_000,
        bufferAfterMs: (svcCfg.bufferAfterMinutes || 0) * 60_000,
        platform,
        svcCfg,
        mode: "all",
      },
    );
    if (!available.length) {
      return {
        ok: false,
        code: "organizer_busy",
        message: "This time is no longer available on the organizer calendar.",
      };
    }
  }

  const primaryParticipant = poll.participants.find((p) => p.status !== "removed");
  const phone = "0000000000";
  const extraRecipients = poll.participants
    .filter((p) => p.status !== "removed" && p.email)
    .map((p) => ({ email: p.email, name: p.name }));

  const result = await createPlatformAppointment(input.workspaceId, {
    serviceId,
    serviceName,
    startsAt: option.startsAt,
    durationMinutes: poll.durationMinutes,
    firstName: primaryParticipant?.name.split(" ")[0] || "Meeting",
    lastName: primaryParticipant?.name.split(" ").slice(1).join(" ") || "Guest",
    phone,
    email: primaryParticipant?.email,
    notes: poll.description,
    source: "admin",
    status: "confirmed",
    staffId: organizer?.id,
    staffName: organizer?.name,
    skipApproval: true,
    extraRecipients: extraRecipients.slice(1),
    bookingAnswers: {
      meetingPollId: poll.id,
      meetingPollOptionId: option.id,
    },
  });

  const appointmentId = String((result as { appointmentId?: string }).appointmentId || "");
  if (!appointmentId) {
    return { ok: false, code: "conflict", message: "Meeting creation failed." };
  }
  const nextPoll = touchPoll(
    appendPollActivity(
      {
        ...poll,
        status: "finalized",
        finalizedOptionId: option.id,
        winningOptionId: option.id,
        bookedAppointmentId: appointmentId,
        finalizeIdempotencyKey: input.idempotencyKey,
      },
      {
        actor: "Organizer",
        action: "Meeting finalized",
        detail: `Created appointment ${appointmentId}`,
      },
    ),
  );

  return { ok: true, appointmentId, poll: nextPoll };
}
