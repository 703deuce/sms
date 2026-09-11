"use client";

import { useEffect, useState } from "react";
import type { IntakeField, IntakeFieldType } from "@/lib/appointments/service-booking/types";
import { createId } from "@/lib/supabase/id";

const INTAKE_API = "/api/appointments/service-booking/intake-forms";

export const INTAKE_FIELD_TYPES: Array<{ value: IntakeFieldType; label: string }> = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Single choice" },
  { value: "checkbox", label: "Checkbox" },
  { value: "multiselect", label: "Multiple choice" },
  { value: "info", label: "Heading / text" },
  { value: "agreement", label: "Agreement" },
  { value: "file", label: "File upload" },
  { value: "image", label: "Image upload" },
  { value: "signature", label: "Signature" },
];

type Props = {
  formId: string;
  formName: string;
  initialFields: IntakeField[];
  onSaved?: () => void;
  compact?: boolean;
};

export function IntakeFormFieldBuilder({ formId, formName, initialFields, onSaved, compact }: Props) {
  const [fields, setFields] = useState<IntakeField[]>(initialFields);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setFields(initialFields);
  }, [formId, initialFields]);

  function addField(type: IntakeFieldType) {
    setFields((prev) => [
      ...prev,
      {
        id: createId(),
        label:
          type === "file"
            ? "Upload a file"
            : type === "image"
              ? "Upload an image"
              : type === "info"
                ? "Section heading"
                : "New question",
        type,
        required: type === "signature" || type === "agreement",
      },
    ]);
  }

  function moveField(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
  }

  async function saveFields() {
    setSaving(true);
    setMessage(null);
    const res = await fetch(INTAKE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: formId, name: formName, fields }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage((json as { error?: string }).error || "Save failed");
      return;
    }
    setMessage("Saved");
    onSaved?.();
  }

  return (
    <div className={`space-y-4 ${compact ? "" : "rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{formName}</h2>
        <div className="flex max-w-full flex-wrap gap-1.5">
          {INTAKE_FIELD_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              className="ws-secondary-btn !px-2 !py-1 text-[11px]"
              onClick={() => addField(type.value)}
            >
              + {type.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2">
        {fields.length === 0 ? (
          <li className="text-sm text-[var(--text-secondary)]">
            Add fields including file, image, signature, or agreement types.
          </li>
        ) : (
          fields.map((field, index) => (
            <li
              key={field.id}
              className="grid gap-2 rounded border border-[var(--border)] bg-[var(--surface-muted)] p-3 lg:grid-cols-[1fr_140px_100px_auto]"
            >
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-[var(--type-helper)] text-[var(--text-secondary)]">Label</span>
                <input
                  className="input"
                  value={field.label}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((f, i) => (i === index ? { ...f, label: e.target.value } : f)),
                    )
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--type-helper)] text-[var(--text-secondary)]">Type</span>
                <select
                  className="input"
                  value={field.type}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((f, i) =>
                        i === index ? { ...f, type: e.target.value as IntakeFieldType } : f,
                      ),
                    )
                  }
                >
                  {INTAKE_FIELD_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.required === true}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((f, i) => (i === index ? { ...f, required: e.target.checked } : f)),
                    )
                  }
                />
                Required
              </label>
              <div className="flex items-end gap-1 pb-1">
                <button
                  type="button"
                  className="ws-icon-btn"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => moveField(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="ws-icon-btn"
                  aria-label="Move down"
                  disabled={index === fields.length - 1}
                  onClick={() => moveField(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ws-icon-btn danger"
                  aria-label="Remove field"
                  onClick={() => setFields((prev) => prev.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
              {["select", "radio", "multiselect"].includes(field.type) ? (
                <label className="col-span-full flex flex-col gap-1 text-sm">
                  <span className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                    Choices (one per line)
                  </span>
                  <textarea
                    className="input min-h-[72px]"
                    value={(field.options || []).join("\n")}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((f, i) =>
                          i === index
                            ? {
                                ...f,
                                options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean),
                              }
                            : f,
                        ),
                      )
                    }
                  />
                </label>
              ) : null}
              {field.type === "text" || field.type === "textarea" ? (
                <label className="col-span-full flex flex-col gap-1 text-sm">
                  <span className="text-[var(--type-helper)] text-[var(--text-secondary)]">Helper text</span>
                  <input
                    className="input"
                    value={field.helpText || ""}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((f, i) => (i === index ? { ...f, helpText: e.target.value } : f)),
                      )
                    }
                  />
                </label>
              ) : null}
              {fields.some((f) => f.id !== field.id && f.type !== "info") ? (
                <label className="col-span-full flex flex-col gap-1 text-sm">
                  <span className="text-[var(--type-helper)] text-[var(--text-secondary)]">
                    Show only when (optional)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="input max-w-[200px]"
                      value={field.conditionalOn?.fieldId || ""}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f, i) =>
                            i === index
                              ? {
                                  ...f,
                                  conditionalOn: e.target.value
                                    ? { fieldId: e.target.value, value: f.conditionalOn?.value || "yes" }
                                    : undefined,
                                }
                              : f,
                          ),
                        )
                      }
                    >
                      <option value="">Always visible</option>
                      {fields
                        .filter((f) => f.id !== field.id && f.type !== "info")
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                    </select>
                    {field.conditionalOn?.fieldId ? (
                      <input
                        className="input max-w-[160px]"
                        placeholder="Equals value"
                        value={field.conditionalOn.value}
                        onChange={(e) =>
                          setFields((prev) =>
                            prev.map((f, i) =>
                              i === index && f.conditionalOn
                                ? { ...f, conditionalOn: { ...f.conditionalOn, value: e.target.value } }
                                : f,
                            ),
                          )
                        }
                      />
                    ) : null}
                  </div>
                </label>
              ) : null}
            </li>
          ))
        )}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="appt-pilot-primary-btn"
          disabled={saving}
          onClick={() => void saveFields()}
        >
          {saving ? "Saving…" : "Save fields"}
        </button>
        {message ? <span className="text-sm text-[var(--text-secondary)]">{message}</span> : null}
      </div>
    </div>
  );
}
