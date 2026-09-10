"use client";

import { useState } from "react";
import Link from "next/link";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { IntakeFormQuickCreate } from "@/components/appointments/service-booking/intake-form-quick-create";

type Props = {
  form: AppointmentTypeFormState;
  intakeFormOptions: Array<{ id: string; name: string; active?: boolean }>;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onOptionsRefresh?: () => void;
};

export function TypeIntakeFormsSection({ form, intakeFormOptions, onFormChange, onOptionsRefresh }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [localOptions, setLocalOptions] = useState(intakeFormOptions);

  const options = (localOptions.length >= intakeFormOptions.length ? localOptions : intakeFormOptions).filter(
    (f) => f.active !== false,
  );

  function toggleForm(id: string) {
    const current = form.intakeFormIds;
    onFormChange(
      "intakeFormIds",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <section aria-labelledby="type-intake-heading">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 id="type-intake-heading" className="text-[14px] font-semibold">
            Intake form
          </h3>
          <p className="text-[12.5px] text-[#8a8fa3] mt-1">
            Reusable form template customers complete during or after booking.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            className="text-[12px] font-medium text-[#5b4bff] hover:underline"
            onClick={() => setCreateOpen(true)}
          >
            Create intake form
          </button>
          <Link href="/appointments/booking/forms" className="text-[12px] font-medium text-[#5b4bff] hover:underline">
            Manage forms →
          </Link>
        </div>
      </div>
      <IntakeFormQuickCreate
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(row) => {
          setLocalOptions((prev) => [...prev.filter((f) => f.id !== row.id), row]);
          onFormChange("intakeFormIds", [...form.intakeFormIds, row.id]);
          onOptionsRefresh?.();
        }}
      />
      {options.length === 0 ? (
        <p className="text-[12.5px] text-[#8a8fa3] rounded-xl border border-dashed border-[#e4e6ee] px-4 py-6 text-center">
          No intake forms yet.{" "}
          <button type="button" className="text-[#5b4bff] hover:underline" onClick={() => setCreateOpen(true)}>
            Create intake form
          </button>
        </p>
      ) : (
        <ul className="space-y-2">
          {options.map((formRow) => (
            <li key={formRow.id}>
              <label
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer ${
                  form.intakeFormIds.includes(formRow.id)
                    ? "border-[#5b4bff] bg-[#f7f6ff]"
                    : "border-[#ecedf2] hover:bg-[#f7f8fb]"
                }`}
              >
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={form.intakeFormIds.includes(formRow.id)}
                  onChange={() => toggleForm(formRow.id)}
                />
                <span className="text-[13px] font-medium text-[#1a1d29]">{formRow.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
