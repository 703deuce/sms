"use client";

import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { ServiceAddOnsPanel } from "@/components/appointments/service-booking/service-add-ons-panel";

type Props = {
  form: AppointmentTypeFormState;
  addOnOptions: Array<{ id: string; name: string; priceCents?: number }>;
  resourceOptions?: Array<{ id: string; name: string }>;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
};

export function TypeAddOnsSection({ form, resourceOptions = [], onFormChange }: Props) {
  function toggleAddOn(id: string) {
    const current = form.addOnIds;
    onFormChange(
      "addOnIds",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <section aria-labelledby="type-addons-heading">
      <h3 id="type-addons-heading" className="text-[14px] font-semibold mb-1">
        Add-ons
      </h3>
      <p className="text-[12.5px] text-[#8a8fa3] mb-3">
        Optional extras customers can select during booking. Configure price, duration, and room effects below.
      </p>
      <ServiceAddOnsPanel
        compact
        selectedIds={form.addOnIds}
        onToggleSelect={toggleAddOn}
        resourceOptions={resourceOptions}
      />
    </section>
  );
}
