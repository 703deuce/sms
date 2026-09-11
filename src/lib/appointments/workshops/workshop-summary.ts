import type { WorkshopFormState } from "@/lib/appointments/workshops/workshop-form";
import {
  primarySession,
  upcomingSessions,
  type WorkshopSessionRow,
} from "@/lib/appointments/workshops/workshop-schedule";

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function workshopPriceLabel(form: WorkshopFormState): string {
  return form.isFree ? "Free" : formatMoney(form.priceCents);
}

/**
 * Seats for a workshop are counted across the whole event, not per session:
 * somebody registers for "the workshop", and a two-day workshop is one place,
 * not two. This is the opposite of a class, where each session sells its own
 * seats.
 */
export function workshopSeats(
  form: WorkshopFormState,
  sessions: WorkshopSessionRow[],
  registeredCount: number,
): { registered: number; capacity: number; remaining: number } {
  const session = primarySession(sessions);
  const capacity = Number(session?.capacity ?? form.capacity) || form.capacity;
  return {
    registered: registeredCount,
    capacity,
    remaining: Math.max(0, capacity - registeredCount),
  };
}

export type WorkshopRegistrationState = {
  tone: "open" | "closed" | "scheduled" | "full" | "cancelled";
  label: string;
  detail: string;
};

/** The single answer to "can someone register right now, and why not". */
export function workshopRegistrationState(
  form: WorkshopFormState,
  sessions: WorkshopSessionRow[],
  registeredCount: number,
): WorkshopRegistrationState {
  if (form.cancelledAt) {
    return {
      tone: "cancelled",
      label: "Cancelled",
      detail: `This workshop was cancelled on ${new Date(form.cancelledAt).toLocaleDateString()}. Existing registrations are kept.`,
    };
  }
  if (!form.active) {
    return { tone: "closed", label: "Closed", detail: "The workshop is inactive." };
  }
  if (form.visibility === "hidden") {
    return {
      tone: "closed",
      label: "Not listed",
      detail: "Hidden workshops are not shown on the public page.",
    };
  }
  const now = Date.now();
  if (form.registrationOpensAt && new Date(form.registrationOpensAt).getTime() > now) {
    return {
      tone: "scheduled",
      label: "Opens later",
      detail: `Registration opens ${new Date(form.registrationOpensAt).toLocaleString()}.`,
    };
  }
  if (form.registrationClosesAt && new Date(form.registrationClosesAt).getTime() < now) {
    return {
      tone: "closed",
      label: "Closed",
      detail: `Registration closed ${new Date(form.registrationClosesAt).toLocaleString()}.`,
    };
  }
  if (upcomingSessions(sessions).length === 0) {
    return {
      tone: "closed",
      label: "No date",
      detail: "Set a date before customers can register.",
    };
  }
  const seats = workshopSeats(form, sessions, registeredCount);
  if (seats.remaining <= 0) {
    return {
      tone: "full",
      label: "Full",
      detail: form.waitlistEnabled
        ? "The workshop is full. New registrations join the waitlist."
        : "The workshop is full and the waitlist is off.",
    };
  }
  return {
    tone: "open",
    label: "Open",
    detail: `${seats.remaining} of ${seats.capacity} spots left.`,
  };
}

/** Where a workshop happens, in one line, however it is configured. */
export function locationLabel(
  form: WorkshopFormState,
  locationNames: Map<string, string>,
): string {
  if (form.locationMode === "virtual") return "Online";
  if (form.locationMode === "custom") return form.locationNote.trim() || "Custom location";
  return locationNames.get(form.locationId) || "No location";
}

export function checkedInCount(
  registrants: Array<{ attendance: string | null; status: string }>,
): number {
  return registrants.filter((r) => r.attendance === "attended" && r.status !== "cancelled").length;
}

export function activeRegistrants<T extends { status: string }>(registrants: T[]): T[] {
  return registrants.filter((r) => r.status !== "cancelled");
}
