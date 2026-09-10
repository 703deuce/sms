"use client";

import Link from "next/link";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";

type Props = {
  form: AppointmentTypeFormState;
  addOnOptions: Array<{ id: string; name: string; priceCents?: number; durationDeltaMinutes?: number }>;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
};

export function TypeAddOnsSection({ form, addOnOptions, onFormChange }: Props) {
  function toggleAddOn(id: string) {
    const current = form.addOnIds;
    onFormChange(
      "addOnIds",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <section aria-labelledby="type-addons-heading">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 id="type-addons-heading" className="text-[14px] font-semibold">
            Add-ons
          </h3>
          <p className="text-[12.5px] text-[#8a8fa3] mt-1">
            Optional extras customers can select during booking. Prices and duration adjustments apply at checkout.
          </p>
        </div>
        <Link
          href="/appointments/types"
          className="text-[12px] font-medium text-[#5b4bff] hover:underline shrink-0"
        >
          Manage add-ons →
        </Link>
      </div>
      {addOnOptions.length === 0 ? (
        <p className="text-[12.5px] text-[#8a8fa3] rounded-xl border border-dashed border-[#e4e6ee] px-4 py-6 text-center">
          No add-ons yet. Create add-ons in commerce settings to offer them here.
        </p>
      ) : (
        <ul className="space-y-2">
          {addOnOptions.map((addOn) => (
            <li key={addOn.id}>
              <label
                className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer ${
                  form.addOnIds.includes(addOn.id)
                    ? "border-[#5b4bff] bg-[#f7f6ff]"
                    : "border-[#ecedf2] hover:bg-[#f7f8fb]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={form.addOnIds.includes(addOn.id)}
                    onChange={() => toggleAddOn(addOn.id)}
                  />
                  <span className="text-[13px] font-medium text-[#1a1d29]">{addOn.name}</span>
                </span>
                <span className="text-[11px] text-[#8a8fa3] text-right">
                  {addOn.priceCents != null && addOn.priceCents > 0
                    ? `+$${(addOn.priceCents / 100).toFixed(2)}`
                    : null}
                  {addOn.durationDeltaMinutes && addOn.durationDeltaMinutes > 0
                    ? `${addOn.priceCents ? " · " : ""}+${addOn.durationDeltaMinutes} min`
                    : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
