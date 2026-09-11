"use client";

import { CalendarClock, ClipboardList, MapPin, Tag, UserRound, Users } from "lucide-react";
import type { ClassFormState, ClassOccurrenceRow } from "@/lib/appointments/classes/class-form";
import {
  classPriceLabel,
  formatSessionTime,
  nextOccurrence,
  seatsForNextSession,
} from "@/lib/appointments/classes/class-summary";

type Props = {
  form: ClassFormState;
  occurrences: ClassOccurrenceRow[];
  waitlistCount: number;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
};

function MetaItem({
  icon: Icon,
  label,
  value,
  unset,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unset?: boolean;
}) {
  return (
    <span className="ws-meta-item" title={`${label}: ${value}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="sr-only">{label}: </span>
      <strong className={unset ? "is-unset" : undefined}>{value}</strong>
    </span>
  );
}

/**
 * One line of the numbers an operator checks constantly. It sits between the
 * header and the section tabs, so anything taller pushes the actual work below
 * the fold on a laptop.
 */
export function ClassSummaryStrip({
  form,
  occurrences,
  waitlistCount,
  staffNames,
  locationNames,
}: Props) {
  const next = nextOccurrence(occurrences);
  const seats = seatsForNextSession(form, occurrences);
  const instructor = form.staffId ? staffNames.get(form.staffId) || "Assigned" : "Not set";
  const location = form.locationId ? locationNames.get(form.locationId) || "Assigned" : "Not set";

  return (
    <div className="ws-meta-strip" aria-label="Class summary">
      <MetaItem
        icon={CalendarClock}
        label="Next session"
        value={next ? formatSessionTime(next.startsAt) : "None scheduled"}
        unset={!next}
      />
      <MetaItem icon={Users} label="Seats" value={`${seats.enrolled}/${seats.capacity}`} />
      <MetaItem
        icon={ClipboardList}
        label="Waitlist"
        value={waitlistCount > 0 ? `${waitlistCount} waiting` : "Empty"}
        unset={waitlistCount === 0}
      />
      <MetaItem icon={UserRound} label="Instructor" value={instructor} unset={!form.staffId} />
      <MetaItem icon={MapPin} label="Location" value={location} unset={!form.locationId} />
      <MetaItem icon={Tag} label="Price" value={classPriceLabel(form)} />
    </div>
  );
}
