"use client";

import type {
  AppointmentReceptionistWizardState,
  VoiceWizardBookingStrategy,
} from "@/lib/solutions/appointment-receptionist/types";
import { RadioRow } from "@/components/solutions/appointment-receptionist/ui";
import Link from "next/link";

export function ReceptionistBookingHandlingSection({
  state,
  patch,
  calendarSummary,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  calendarSummary: { connected: boolean; label: string };
}) {
  const b = state.bookingBehavior;
  const booking = state.capabilities.includes("book_appointments");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Calendar connection</p>
          <p className="text-xs text-muted-foreground">
            {calendarSummary.connected
              ? calendarSummary.label
              : "Calendar connection required for live booking"}
          </p>
        </div>
        <Link href="/integrations" className="text-sm font-medium text-primary hover:underline">
          {calendarSummary.connected ? "Manage integrations" : "Connect calendar →"}
        </Link>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          When someone wants an appointment
        </p>
        <div className="mt-3 space-y-2">
          {(
            [
              [
                "MICROSOFT_365",
                "Book an appointment for them",
                "Check live calendar availability and book on the call.",
              ],
              [
                "REQUEST_ONLY",
                "Take their preferred time and have us confirm it",
                "Collect preferred day/time — your team confirms later.",
              ],
              [
                "SEND_LINK",
                "Send our booking link",
                "Text a link so they can pick a time themselves.",
              ],
              [
                "NONE",
                "Take a message / have us follow up",
                "Not an appointment request flow.",
              ],
            ] as Array<[VoiceWizardBookingStrategy, string, string]>
          ).map(([id, label, desc]) => (
            <RadioRow
              key={id}
              selected={(state.bookingStrategy || "MICROSOFT_365") === id}
              onClick={() => {
                const caps = new Set(state.capabilities);
                if (id === "NONE") {
                  caps.delete("book_appointments");
                  caps.add("take_messages");
                } else {
                  caps.add("book_appointments");
                }
                patch({
                  bookingStrategy: id,
                  capabilities: [...caps],
                });
              }}
              label={label}
              description={desc}
            />
          ))}
        </div>
      </div>

      {booking ? (
        <div>
          <h3 className="text-sm font-semibold">Booking behavior</h3>
          <div className="mt-3 space-y-3">
            {(
              [
                ["askPreferredDayFirst", "Ask for preferred day first", ""],
                ["offerEarliestThree", "Offer earliest 3 appointments", ""],
                ["confirmBeforeBooking", "Confirm before booking", ""],
                ["sendSmsAfterBooking", "Send SMS after booking", ""],
              ] as const
            ).map(([key, label, desc]) => (
              <label key={key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border"
                  checked={b[key]}
                  onChange={(e) =>
                    patch({
                      bookingBehavior: { ...b, [key]: e.target.checked },
                    })
                  }
                />
                <span>
                  <span className="font-medium">{label}</span>
                  {desc ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
