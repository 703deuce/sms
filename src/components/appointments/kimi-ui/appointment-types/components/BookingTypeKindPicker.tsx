"use client";

import {
  BOOKING_TYPE_KINDS,
  BOOKING_TYPE_KIND_DESCRIPTIONS,
  BOOKING_TYPE_KIND_LABELS,
  defaultConfigPatchForKind,
  featuresForBookingTypeKind,
  type BookingTypeKind,
} from "@/lib/appointments/booking-type-kind";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";

type Props = {
  form: AppointmentTypeFormState;
  isCreating: boolean;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
};

export function BookingTypeKindPicker({ form, isCreating, onFormChange }: Props) {
  const features = featuresForBookingTypeKind(form.bookingTypeKind);

  function selectKind(kind: BookingTypeKind) {
    onFormChange("bookingTypeKind", kind);
    const patch = defaultConfigPatchForKind(kind);
    if (kind === "CLASS") {
      onFormChange("groupBookingEnabled", true);
      onFormChange("groupCapacity", patch.groupCapacity ?? 10);
    }
    if (kind === "MEETING") {
      onFormChange("paymentMode", "none");
      onFormChange("recurringEnabled", false);
      onFormChange("groupBookingEnabled", false);
    }
  }

  return (
    <section aria-labelledby="booking-type-kind-heading">
      <h3 id="booking-type-kind-heading" className="text-[14px] font-semibold mb-1">
        Booking type
      </h3>
      <p className="text-[12.5px] text-[#8a8fa3] mb-4">
        Choose the archetype that matches how customers book. Advanced settings appear based on type.
      </p>
      <div
        className="grid gap-2 sm:grid-cols-3"
        role="radiogroup"
        aria-label="Booking type archetype"
      >
        {BOOKING_TYPE_KINDS.map((kind) => {
          const selected = form.bookingTypeKind === kind;
          return (
            <label
              key={kind}
              className={`flex flex-col rounded-xl border p-3.5 cursor-pointer transition-colors ${
                selected
                  ? "border-[#5b4bff] bg-[#f7f6ff] ring-1 ring-[#dcd9ff]"
                  : "border-[#ecedf2] hover:border-[#d8dbe6] hover:bg-[#fafbfc]"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="bookingTypeKind"
                  className="radio"
                  checked={selected}
                  disabled={!isCreating}
                  onChange={() => selectKind(kind)}
                />
                <span className="text-[13px] font-semibold text-[#1a1d29]">
                  {BOOKING_TYPE_KIND_LABELS[kind]}
                </span>
              </span>
              <span className="mt-1.5 text-[11.5px] leading-snug text-[#8a8fa3] pl-6">
                {BOOKING_TYPE_KIND_DESCRIPTIONS[kind]}
              </span>
            </label>
          );
        })}
      </div>
      {!isCreating ? (
        <p className="mt-2 text-[11.5px] text-[#8a8fa3]">
          Archetype is locked after creation to avoid breaking existing bookings. Duplicate this type to
          change archetype.
        </p>
      ) : null}
      <p className="mt-3 text-[11.5px] text-[#6b6f82]">
        {form.bookingTypeKind === "MEETING"
          ? "Minimal flow: name → duration → location → availability."
          : form.bookingTypeKind === "SERVICE"
            ? "Includes payments, packages, recurrence, resources, and add-ons when configured."
            : "Includes capacity, roster, series enrollment, and waitlist when configured."}
        {!features.showPayment && !features.showClassEnrollment ? null : (
          <span className="block mt-1 text-[#8a8fa3]">
            {[
              features.showPayment && "payments",
              features.showRecurring && "recurrence",
              features.showResources && "resources",
              features.showClassEnrollment && "class enrollment",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </p>
    </section>
  );
}
