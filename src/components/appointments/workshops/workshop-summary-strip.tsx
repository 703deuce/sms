"use client";

import { CalendarDays, MapPin, Ticket, UserRound, Users, Wallet } from "lucide-react";
import type { WorkshopFormState } from "@/lib/appointments/workshops/workshop-form";
import type { WorkshopSessionRow } from "@/lib/appointments/workshops/workshop-schedule";
import { formatSessionFull, primarySession } from "@/lib/appointments/workshops/workshop-schedule";
import {
  locationLabel,
  workshopPriceLabel,
  workshopSeats,
} from "@/lib/appointments/workshops/workshop-summary";

type Props = {
  form: WorkshopFormState;
  sessions: WorkshopSessionRow[];
  registeredCount: number;
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
 * One line of the six numbers somebody running an event checks constantly. It
 * sits between the header and the section tabs, so anything taller pushes the
 * actual work below the fold on a laptop.
 */
export function WorkshopSummaryStrip({
  form,
  sessions,
  registeredCount,
  staffNames,
  locationNames,
}: Props) {
  const session = primarySession(sessions);
  const seats = workshopSeats(form, sessions, registeredCount);
  const host = form.staffId ? staffNames.get(form.staffId) || "Assigned" : "Not set";
  const place = locationLabel(form, locationNames);
  const placeUnset = form.locationMode === "in_person" && !form.locationId;

  return (
    <div className="ws-meta-strip" aria-label="Workshop summary">
      <MetaItem
        icon={CalendarDays}
        label="Date"
        value={session ? formatSessionFull(session.startsAt, session.endsAt) : "No date set"}
        unset={!session}
      />
      <MetaItem icon={Users} label="Registered" value={String(seats.registered)} />
      <MetaItem
        icon={Ticket}
        label="Capacity"
        value={`${seats.registered} / ${seats.capacity}`}
      />
      <MetaItem icon={MapPin} label="Location" value={place} unset={placeUnset} />
      <MetaItem icon={Wallet} label="Price" value={workshopPriceLabel(form)} />
      <MetaItem icon={UserRound} label="Host" value={host} unset={!form.staffId} />
    </div>
  );
}
