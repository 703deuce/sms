"use client";

import { CalendarCheck, CalendarDays, Clock, MapPin, Phone, Plus, Repeat, User, Users } from "lucide-react";
import { formatSlotDate, formatSlotTime } from "../mock-data";
import type { BookingState } from "../page";

export default function ConfirmationStep({
  state,
  staffName,
  locationName,
  locationAddress,
  workspaceName,
  businessPhone,
  waitlist,
}: {
  state: BookingState;
  staffName?: string;
  locationName?: string;
  locationAddress?: string;
  workspaceName: string;
  businessPhone: string;
  waitlist: boolean;
}) {
  const type = state.type!;
  const slot = state.slot;
  const recurringLabel =
    state.recurringMode === "once"
      ? null
      : `${state.recurringOccurrences} sessions · ${
          state.recurringMode === "weekly"
            ? "weekly"
            : state.recurringMode === "biweekly"
              ? "every 2 weeks"
              : "monthly"
        }`;

  function downloadIcs() {
    if (!slot) return;
    const toStamp = (iso: string) =>
      new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Transovo//Booking//EN",
      "BEGIN:VEVENT",
      `UID:${Date.now()}@transovo`,
      `DTSTAMP:${toStamp(new Date().toISOString())}`,
      `DTSTART:${toStamp(slot.startsAt)}`,
      `DTEND:${toStamp(slot.endsAt)}`,
      `SUMMARY:${type.name} — ${workspaceName}`,
      locationName ? `LOCATION:${locationName}${locationAddress ? `, ${locationAddress}` : ""}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "appointment.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="eb-done">
      <div className="eb-done__icon">
        <CalendarCheck size={26} aria-hidden />
      </div>
      <h1 className="eb-done__title">{waitlist ? "You're on the waitlist" : "You're booked!"}</h1>
      <p className="eb-done__sub">
        {waitlist
          ? `We'll text ${state.phone || "you"} as soon as a spot opens up for ${type.name}.`
          : `A confirmation${state.smsConsent ? " text and" : ""} email is on its way to ${
              state.email || "you"
            }.`}
      </p>

      {!waitlist && slot ? (
        <div className="eb-done__card">
          <div className="eb-summary__title">{type.name}</div>
          <div className="eb-summary__row">
            <CalendarDays size={13} aria-hidden />
            {formatSlotDate(slot.startsAt)}
          </div>
          <div className="eb-summary__row">
            <Clock size={13} aria-hidden />
            {formatSlotTime(slot.startsAt)} – {formatSlotTime(slot.endsAt)} · Eastern Time
          </div>
          {recurringLabel ? (
            <div className="eb-summary__row">
              <Repeat size={13} aria-hidden /> {recurringLabel}
            </div>
          ) : null}
          {state.attendeeCount > 1 ? (
            <div className="eb-summary__row">
              <Users size={13} aria-hidden /> {state.attendeeCount} attendees
            </div>
          ) : null}
          {staffName ? (
            <div className="eb-summary__row">
              <User size={13} aria-hidden /> {staffName}
            </div>
          ) : null}
          {locationName ? (
            <div className="eb-summary__row">
              <MapPin size={13} aria-hidden />
              {locationName}
              {locationAddress ? ` — ${locationAddress}` : ""}
            </div>
          ) : null}
          <div className="eb-summary__row">
            <Phone size={13} aria-hidden /> {workspaceName} · {businessPhone}
          </div>
        </div>
      ) : null}

      {!waitlist ? (
        <>
          <div className="eb-done__cta">
            <button type="button" className="eb-btn eb-btn--outline" onClick={downloadIcs}>
              <Plus size={15} aria-hidden /> Add to calendar
            </button>
          </div>
          <div className="eb-done__links">
            Need to make a change? <a href="#reschedule">Reschedule</a> ·{" "}
            <a href="#cancel">Cancel appointment</a>
          </div>
        </>
      ) : null}
    </div>
  );
}
