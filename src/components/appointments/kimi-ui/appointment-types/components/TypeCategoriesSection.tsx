"use client";

import { useState } from "react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { ServiceCategoriesDrawer } from "@/components/appointments/service-booking/service-categories-drawer";

type Props = {
  form: AppointmentTypeFormState;
  categoryOptions: Array<{ id: string; name: string }>;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onCategoriesChanged?: () => void;
};

export function TypeCategoriesSection({ form, categoryOptions, onFormChange, onCategoriesChanged }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <section aria-labelledby="type-categories-heading">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 id="type-categories-heading" className="text-[14px] font-semibold">
            Category & image
          </h3>
          <p className="text-[12.5px] text-[#8a8fa3] mt-1">
            Group this type on your public booking page and optionally show a service image.
          </p>
        </div>
        <button
          type="button"
          className="text-[12px] font-medium text-[#5b4bff] hover:underline shrink-0"
          onClick={() => setDrawerOpen(true)}
        >
          Manage categories →
        </button>
      </div>
      <ServiceCategoriesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onChanged={onCategoriesChanged}
      />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="type-category">Category</label>
          <select
            id="type-category"
            className="input w-full"
            value={form.categoryId}
            onChange={(e) => onFormChange("categoryId", e.target.value)}
          >
            <option value="">No category</option>
            {categoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="type-image-url">Image URL</label>
          <input
            id="type-image-url"
            className="input w-full"
            type="url"
            placeholder="https://…"
            value={form.imageUrl}
            onChange={(e) => onFormChange("imageUrl", e.target.value)}
          />
          <p className="mt-1 text-[11px] text-[#8a8fa3]">Shown on the public service picker when set.</p>
        </div>
      </div>
      {form.imageUrl ? (
        <div className="mt-3 rounded-xl border border-[#ecedf2] overflow-hidden max-w-[200px]">
          <img
            src={form.imageUrl}
            alt=""
            className="w-full h-28 object-cover"
          />
        </div>
      ) : null}
    </section>
  );
}
