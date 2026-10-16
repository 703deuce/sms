"use client";

import type {
  AppointmentReceptionistWizardState,
  VoiceWizardBookingStrategy,
} from "@/lib/solutions/appointment-receptionist/types";
import { FieldRow, Panel, TextLink } from "@/newui-transplant/components/app/kit";
import { Switch } from "@/newui-transplant/components/ui/switch";
import { SelectableCard } from "@/components/solutions/appointment-receptionist/ui";
import { patchWizardBookingStrategy } from "@/lib/solutions/appointment-receptionist/booking-strategy-ui";
import { Calendar } from "lucide-react";

const STRATEGIES: Array<[VoiceWizardBookingStrategy, string, string]> = [
  [
    "MICROSOFT_365",
    "Book an appointment for them",
    "Check availability and book during the call.",
  ],
  [
    "REQUEST_ONLY",
    "Take their preferred time and have us confirm it",
    "Collect preferred day/time for team confirmation.",
  ],
  ["SEND_LINK", "Send our booking link", "Text the customer a booking link."],
  ["NONE", "Take a message / have us follow up", "No appointment booking flow."],
];

export function ReceptionistBookingOpus({
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
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Calendar className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Calendar connection</p>
            <p className="text-xs text-muted-foreground">
              {calendarSummary.connected
                ? calendarSummary.label
                : "Calendar connection required for live booking"}
            </p>
          </div>
        </div>
        <TextLink href="/integrations">
          {calendarSummary.connected ? "Manage integrations" : "Connect calendar"}
        </TextLink>
      </div>

      <div>
        <p className="text-sm font-medium">When someone wants an appointment</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {STRATEGIES.map(([id, label, desc]) => {
            const selected = (state.bookingStrategy || "MICROSOFT_365") === id;
            return (
              <SelectableCard
                key={id}
                variant="opus"
                selected={selected}
                title={label}
                description={desc}
                onClick={() => patch(patchWizardBookingStrategy(state, id))}
              />
            );
          })}
        </div>
      </div>

      {booking ? (
        <Panel title="Booking behavior" bodyClassName="divide-y p-0">
          <div className="grid gap-0 p-5 sm:grid-cols-2 sm:gap-x-8">
            <FieldRow label="Ask for preferred day first">
              <Switch
                checked={Boolean(b?.askPreferredDayFirst)}
                onCheckedChange={(on) =>
                  patch({ bookingBehavior: { ...b, askPreferredDayFirst: on } })
                }
              />
            </FieldRow>
            <FieldRow label="Offer earliest 3 appointments">
              <Switch
                checked={Boolean(b?.offerEarliestThree)}
                onCheckedChange={(on) =>
                  patch({ bookingBehavior: { ...b, offerEarliestThree: on } })
                }
              />
            </FieldRow>
            <FieldRow label="Confirm before booking">
              <Switch
                checked={Boolean(b?.confirmBeforeBooking)}
                onCheckedChange={(on) =>
                  patch({ bookingBehavior: { ...b, confirmBeforeBooking: on } })
                }
              />
            </FieldRow>
            <FieldRow label="Send SMS after booking">
              <Switch
                checked={Boolean(b?.sendSmsAfterBooking)}
                onCheckedChange={(on) =>
                  patch({ bookingBehavior: { ...b, sendSmsAfterBooking: on } })
                }
              />
            </FieldRow>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
