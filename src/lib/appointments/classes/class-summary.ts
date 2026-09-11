import type { ClassFormState, ClassOccurrenceRow } from "@/lib/appointments/classes/class-form";

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function classPriceLabel(form: ClassFormState): string {
  return form.isFree ? "Free" : formatMoney(form.priceCents);
}

export function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSessionRange(startsAt: string, endsAt: string): string {
  const end = new Date(endsAt);
  const time = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${formatSessionTime(startsAt)} – ${time}`;
}

export function upcomingOccurrences(occurrences: ClassOccurrenceRow[]): ClassOccurrenceRow[] {
  const now = Date.now();
  return occurrences
    .filter((o) => new Date(o.startsAt).getTime() >= now && o.status !== "cancelled")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function nextOccurrence(occurrences: ClassOccurrenceRow[]): ClassOccurrenceRow | null {
  return upcomingOccurrences(occurrences)[0] ?? null;
}

/**
 * Seats are counted against the next session rather than the whole series: a
 * weekly class with twelve sessions has twelve separate capacities, and one
 * combined number would mean nothing to whoever is running the door.
 */
export function seatsForNextSession(
  form: ClassFormState,
  occurrences: ClassOccurrenceRow[],
): { enrolled: number; capacity: number; remaining: number } {
  const next = nextOccurrence(occurrences);
  const capacity = Number(next?.capacity ?? form.capacity) || form.capacity;
  const enrolled = Number(next?.enrolled ?? 0);
  return { enrolled, capacity, remaining: Math.max(0, capacity - enrolled) };
}

export type RegistrationState = {
  tone: "open" | "closed" | "scheduled" | "full";
  label: string;
  detail: string;
};

/** The single answer to "can someone register right now, and why not". */
export function registrationState(
  form: ClassFormState,
  occurrences: ClassOccurrenceRow[],
): RegistrationState {
  if (!form.active) {
    return { tone: "closed", label: "Closed", detail: "The class is inactive." };
  }
  if (form.visibility === "hidden") {
    return {
      tone: "closed",
      label: "Not listed",
      detail: "Hidden classes are not shown on the public page.",
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
  const upcoming = upcomingOccurrences(occurrences);
  if (upcoming.length === 0) {
    return {
      tone: "closed",
      label: "No sessions",
      detail: "Add a session before customers can register.",
    };
  }
  const seats = seatsForNextSession(form, occurrences);
  if (seats.remaining <= 0) {
    return {
      tone: "full",
      label: "Full",
      detail: form.waitlistEnabled
        ? "The next session is full. New registrations join the waitlist."
        : "The next session is full and the waitlist is off.",
    };
  }
  return {
    tone: "open",
    label: "Open",
    detail: `${seats.remaining} of ${seats.capacity} seats left on the next session.`,
  };
}
