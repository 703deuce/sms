import type { ConfirmedBooking } from "./booking-types";
import type { ExistingAppointment, ExistingAppointmentCustomerIdentity } from "./appointment-management-types";
import { existingAppointmentFromConfirmed } from "./appointment-management-types";

type StoredRow = {
  appointment: ExistingAppointment;
  status: "ACTIVE" | "CANCELED" | "RESCHEDULED";
};

const byInternalId = new Map<string, StoredRow>();
const byPhone = new Map<string, Set<string>>();
const byEmail = new Map<string, Set<string>>();

function normPhone(p: string): string {
  return p.replace(/\D/g, "");
}

function normEmail(e: string): string {
  return e.trim().toLowerCase();
}

export function registerDurableBooking(
  confirmed: ConfirmedBooking,
  identity: ExistingAppointmentCustomerIdentity,
): ExistingAppointment {
  const appointment = existingAppointmentFromConfirmed(confirmed, identity);
  byInternalId.set(appointment.internalBookingId, { appointment, status: "ACTIVE" });
  if (identity.phone?.trim()) {
    const key = normPhone(identity.phone);
    const set = byPhone.get(key) ?? new Set();
    set.add(appointment.internalBookingId);
    byPhone.set(key, set);
  }
  if (identity.email?.trim()) {
    const key = normEmail(identity.email);
    const set = byEmail.get(key) ?? new Set();
    set.add(appointment.internalBookingId);
    byEmail.set(key, set);
  }
  return appointment;
}

export function updateDurableBookingTimes(
  internalBookingId: string,
  patch: Pick<ExistingAppointment, "startUtc" | "endUtc" | "localStart" | "localEnd">,
): void {
  const row = byInternalId.get(internalBookingId);
  if (!row || row.status !== "ACTIVE") return;
  row.appointment = { ...row.appointment, ...patch };
}

export function markDurableBookingCanceled(internalBookingId: string): void {
  const row = byInternalId.get(internalBookingId);
  if (row) row.status = "CANCELED";
}

export function lookupActiveAppointments(input: {
  phone?: string;
  email?: string;
}): ExistingAppointment[] {
  const ids = new Set<string>();
  if (input.phone?.trim()) {
    for (const id of byPhone.get(normPhone(input.phone)) ?? []) ids.add(id);
  }
  if (input.email?.trim()) {
    for (const id of byEmail.get(normEmail(input.email)) ?? []) ids.add(id);
  }
  const out: ExistingAppointment[] = [];
  for (const id of ids) {
    const row = byInternalId.get(id);
    if (row?.status === "ACTIVE") out.push(row.appointment);
  }
  out.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  return out;
}

export function getDurableAppointmentById(internalBookingId: string): ExistingAppointment | null {
  const row = byInternalId.get(internalBookingId);
  if (!row || row.status !== "ACTIVE") return null;
  return row.appointment;
}

/** Test-only */
export function clearDurableBookingStore(): void {
  byInternalId.clear();
  byPhone.clear();
  byEmail.clear();
}
