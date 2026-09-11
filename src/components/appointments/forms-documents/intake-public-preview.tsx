"use client";

import type { IntakeField } from "@/lib/appointments/service-booking/types";
import type { IntakeFormMetadata } from "@/lib/appointments/service-booking/intake-forms";

type Props = {
  name: string;
  metadata?: IntakeFormMetadata;
  fields: IntakeField[];
};

export function IntakePublicPreview({ name, metadata, fields }: Props) {
  const title = metadata?.customerTitle?.trim() || name;
  const instructions = metadata?.customerInstructions?.trim();
  const visible = fields.filter((f) => f.type !== "info" || f.label);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
        Customer preview
      </p>
      <h3 className="mt-2 text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      {instructions ? (
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{instructions}</p>
      ) : null}
      <div className="mt-4 space-y-3">
        {visible.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Add fields in the form builder.</p>
        ) : (
          visible.map((field) => (
            <div key={field.id} className="space-y-1">
              {field.type === "info" ? (
                <p className="text-sm font-medium text-[var(--text-primary)]">{field.label}</p>
              ) : (
                <>
                  <label className="block text-sm font-medium text-[var(--text-primary)]">
                    {field.label}
                    {field.required ? <span className="text-[var(--accent)]"> *</span> : null}
                  </label>
                  {field.helpText ? (
                    <p className="text-xs text-[var(--text-secondary)]">{field.helpText}</p>
                  ) : null}
                  {field.type === "textarea" ? (
                    <div className="h-16 rounded-md border border-[var(--border)] bg-[var(--surface)]" />
                  ) : field.type === "signature" ? (
                    <div className="flex h-14 items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-secondary)]">
                      Sign here
                    </div>
                  ) : field.type === "file" || field.type === "image" ? (
                    <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                      Upload {field.type === "image" ? "image" : "file"}
                    </div>
                  ) : field.type === "agreement" ? (
                    <label className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 h-4 w-4 rounded border border-[var(--border)]" />
                      <span>I agree</span>
                    </label>
                  ) : field.type === "select" || field.type === "radio" ? (
                    <div className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)]" />
                  ) : (
                    <div className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)]" />
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
      <button type="button" className="appt-pilot-primary-btn mt-4 w-full sm:w-auto" disabled>
        Continue
      </button>
    </div>
  );
}
