"use client";

import Link from "next/link";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";

type Props = {
  form: AppointmentTypeFormState;
  resourceOptions: Array<{ id: string; name: string; quantity?: number }>;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
};

export function TypeResourcesSection({ form, resourceOptions, onFormChange }: Props) {
  function toggleResource(id: string) {
    const current = form.resourceIds;
    onFormChange(
      "resourceIds",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <section aria-labelledby="type-resources-heading">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 id="type-resources-heading" className="text-[14px] font-semibold">
            Resources
          </h3>
          <p className="text-[12.5px] text-[#8a8fa3] mt-1">
            Rooms, equipment, or other limited assets required for this booking type. Availability blocks slots when
            resources are fully booked.
          </p>
        </div>
        <Link
          href="/appointments/booking/rooms-equipment"
          className="text-[12px] font-medium text-[#5b4bff] hover:underline shrink-0"
        >
          Manage rooms & equipment →
        </Link>
      </div>
      {resourceOptions.length === 0 ? (
        <p className="text-[12.5px] text-[#8a8fa3] rounded-xl border border-dashed border-[#e4e6ee] px-4 py-6 text-center">
          No resources yet.{" "}
          <Link href="/appointments/booking/rooms-equipment" className="text-[#5b4bff] hover:underline">
            Add room or equipment
          </Link>{" "}
          to assign it here.
        </p>
      ) : (
        <ul className="space-y-2">
          {resourceOptions.map((resource) => (
            <li key={resource.id}>
              <label
                className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer ${
                  form.resourceIds.includes(resource.id)
                    ? "border-[#5b4bff] bg-[#f7f6ff]"
                    : "border-[#ecedf2] hover:bg-[#f7f8fb]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={form.resourceIds.includes(resource.id)}
                    onChange={() => toggleResource(resource.id)}
                  />
                  <span className="text-[13px] font-medium text-[#1a1d29]">{resource.name}</span>
                </span>
                {resource.quantity != null && resource.quantity > 1 ? (
                  <span className="text-[11px] text-[#8a8fa3]">Qty {resource.quantity}</span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
