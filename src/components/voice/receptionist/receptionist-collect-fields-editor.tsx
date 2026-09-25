"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { Plus } from "lucide-react";

export function ReceptionistCollectFieldsEditor({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const selected =
    state.appointmentTypes.find((t) => t.id === state.selectedAppointmentTypeId) ||
    state.appointmentTypes[0];

  function moveField(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= state.collectFields.length) return;
    const copy = [...state.collectFields];
    const [row] = copy.splice(index, 1);
    copy.splice(next, 0, row);
    patch({ collectFields: copy });
  }

  return (
    <div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-border"
          checked={state.qualificationEnabled === true}
          onChange={(e) => patch({ qualificationEnabled: e.target.checked })}
        />
        <span>
          <span className="font-medium">Qualify callers before booking</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Use ZIP or custom rules when enabled.
          </span>
        </span>
      </label>

      <div className="mt-4 space-y-2">
        {state.collectFields.map((field, index) => (
          <div
            key={field.id}
            className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={field.enabled !== false}
                onChange={() => {
                  const next = state.collectFields.map((f, i) =>
                    i === index ? { ...f, enabled: !f.enabled } : f,
                  );
                  patch({ collectFields: next });
                }}
                className="h-4 w-4 rounded border-border text-primary"
                aria-label={`Enable ${field.label}`}
              />
              <input
                className="min-w-[8rem] flex-1 rounded-md border border-border px-2 py-1 text-sm"
                value={field.label}
                onChange={(e) => {
                  const next = state.collectFields.map((f, i) =>
                    i === index ? { ...f, label: e.target.value } : f,
                  );
                  patch({ collectFields: next });
                }}
                aria-label="Field label"
              />
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={Boolean(field.required)}
                  onChange={() => {
                    const next = state.collectFields.map((f, i) =>
                      i === index ? { ...f, required: !f.required } : f,
                    );
                    patch({ collectFields: next });
                    if (selected) {
                      const ids = next
                        .filter((f) => f.enabled !== false && f.required)
                        .map((f) => f.id);
                      patch({
                        appointmentTypes: state.appointmentTypes.map((t) =>
                          t.id === selected.id ? { ...t, requiredFields: ids } : t,
                        ),
                      });
                    }
                  }}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                Required
              </label>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-[11px]"
                onClick={() => moveField(index, -1)}
                disabled={index === 0}
                aria-label="Move field up"
              >
                Up
              </button>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-[11px]"
                onClick={() => moveField(index, 1)}
                disabled={index === state.collectFields.length - 1}
                aria-label="Move field down"
              >
                Down
              </button>
              {!["full_name", "phone", "service"].includes(field.id) ? (
                <button
                  type="button"
                  className="text-[11px] font-semibold text-destructive"
                  onClick={() => {
                    patch({
                      collectFields: state.collectFields.filter((_, i) => i !== index),
                    });
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          id="receptionist-new-collect-field"
          className="h-9 min-w-[10rem] flex-1 rounded-lg border border-border px-2 text-sm"
          placeholder="New field label"
        />
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[12px] font-semibold"
          onClick={() => {
            const input = document.getElementById(
              "receptionist-new-collect-field",
            ) as HTMLInputElement | null;
            const label = input?.value.trim();
            if (!label || !input) return;
            const id = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
            patch({
              collectFields: [
                ...state.collectFields,
                { id, label, required: true, enabled: true },
              ],
            });
            input.value = "";
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add field
        </button>
      </div>
    </div>
  );
}
