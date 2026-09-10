"use client";

import { useState } from "react";
import Link from "next/link";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { ServiceResourceQuickCreate } from "@/components/appointments/service-booking/service-resource-quick-create";

type Props = {
  form: AppointmentTypeFormState;
  resourceOptions: Array<{ id: string; name: string; quantity?: number }>;
  locationOptions?: Array<{ id: string; name: string }>;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onOptionsRefresh?: () => void;
};

export function TypeResourcesSection({
  form,
  resourceOptions,
  locationOptions = [],
  onFormChange,
  onOptionsRefresh,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [localOptions, setLocalOptions] = useState(resourceOptions);

  const options = localOptions.length >= resourceOptions.length ? localOptions : resourceOptions;

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
            Required rooms & equipment
          </h3>
          <p className="text-[12.5px] text-[#8a8fa3] mt-1">
            Physical rooms or equipment that must be available for this service.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            className="text-[12px] font-medium text-[#5b4bff] hover:underline"
            onClick={() => setCreateOpen(true)}
          >
            Add room or equipment
          </button>
          <Link href="/appointments/booking/rooms-equipment" className="text-[12px] font-medium text-[#5b4bff] hover:underline">
            Manage →
          </Link>
        </div>
      </div>
      <ServiceResourceQuickCreate
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        locations={locationOptions}
        onCreated={(row) => {
          setLocalOptions((prev) => [...prev.filter((r) => r.id !== row.id), row]);
          onFormChange("resourceIds", [...form.resourceIds, row.id]);
          onOptionsRefresh?.();
        }}
      />
      {options.length === 0 ? (
        <p className="text-[12.5px] text-[#8a8fa3] rounded-xl border border-dashed border-[#e4e6ee] px-4 py-6 text-center">
          No rooms or equipment yet.{" "}
          <button type="button" className="text-[#5b4bff] hover:underline" onClick={() => setCreateOpen(true)}>
            Add room or equipment
          </button>{" "}
          to assign it here.
        </p>
      ) : (
        <ul className="space-y-2">
          {options.map((resource) => (
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
