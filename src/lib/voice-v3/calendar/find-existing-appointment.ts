import { createId } from "@/lib/supabase/id";
import type {
  ExistingAppointment,
  ExistingAppointmentCandidateSet,
  FindExistingAppointmentRequest,
  FindExistingAppointmentResult,
} from "./appointment-management-types";
import { lookupActiveAppointments } from "./durable-booking-store";
import { verifyCallerForCandidates } from "./verify-appointment-caller";

function matchesDateHint(appointment: ExistingAppointment, localDate: string | null | undefined): boolean {
  if (!localDate) return true;
  return appointment.localStart.startsWith(localDate);
}

export function findExistingAppointment(request: FindExistingAppointmentRequest): FindExistingAppointmentResult {
  if (!request.phone?.trim() && !request.email?.trim()) {
    return { status: "VERIFICATION_FAILED", reason: "missing_phone_or_email" };
  }

  const raw = lookupActiveAppointments({
    phone: request.phone,
    email: request.email,
  });

  const verified = verifyCallerForCandidates(raw, {
    phone: request.phone,
    email: request.email,
  });

  const dateFiltered = verified.filter((a) =>
    matchesDateHint(a, request.dateHint?.localDate ?? null),
  );

  if (dateFiltered.length === 0) {
    return verified.length > 0 && request.dateHint?.localDate
      ? { status: "NONE" }
      : verified.length === 0
        ? { status: "NONE" }
        : { status: "NONE" };
  }

  if (dateFiltered.length === 1) {
    return { status: "FOUND", appointment: dateFiltered[0]! };
  }

  const candidateSet: ExistingAppointmentCandidateSet = {
    candidateSetId: `cand_set_${createId()}`,
    createdAt: new Date().toISOString(),
    candidates: dateFiltered.map((appointment, i) => ({
      candidateId: `cand_${i + 1}`,
      appointment,
    })),
  };

  return { status: "MULTIPLE", candidateSet };
}
