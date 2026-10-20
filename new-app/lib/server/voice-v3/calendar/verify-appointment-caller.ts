import type { ExistingAppointment } from "./appointment-management-types";

/**
 * Deterministic verification — never name-only.
 * Requires phone or email match when those are the lookup keys used.
 */
export function verifyCallerForAppointment(
  appointment: ExistingAppointment,
  caller: { phone?: string; email?: string; callId?: string },
): boolean {
  const storedPhone = appointment.customerIdentity.phone?.replace(/\D/g, "");
  const callerPhone = caller.phone?.replace(/\D/g, "");
  if (storedPhone && callerPhone && storedPhone === callerPhone) return true;

  const storedEmail = appointment.customerIdentity.email?.trim().toLowerCase();
  const callerEmail = caller.email?.trim().toLowerCase();
  if (storedEmail && callerEmail && storedEmail === callerEmail) return true;

  return false;
}

export function verifyCallerForCandidates(
  appointments: ExistingAppointment[],
  caller: { phone?: string; email?: string },
): ExistingAppointment[] {
  return appointments.filter((a) => verifyCallerForAppointment(a, caller));
}
