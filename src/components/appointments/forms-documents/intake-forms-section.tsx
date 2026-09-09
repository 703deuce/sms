"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";

type IntakeFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "file"
  | "image";

type IntakeField = {
  id: string;
  label: string;
  type: IntakeFieldType;
  required?: boolean;
  helpText?: string;
  options?: string[];
};

const FIELD_TYPES: Array<{ value: IntakeFieldType; label: string }> = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "file", label: "File upload" },
  { value: "image", label: "Image upload" },
];

function createId() {
  return `field_${Math.random().toString(36).slice(2, 10)}`;
}

type FormRow = { id: string; name: string; fields?: IntakeField[]; active?: boolean };

export function IntakeFormsSection() {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fields, setFields] = useState<IntakeField[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/appointments/service-booking/intake-forms");
    const json = await res.json();
    const list = (json.data || json || []) as FormRow[];
    setForms(list);
    if (!selectedId && list[0]) setSelectedId(list[0].id);
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = forms.find((f) => f.id === selectedId) || null;

  useEffect(() => {
    setFields(selected?.fields || []);
  }, [selected]);

  async function createForm() {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/intake-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), fields: [] }),
    });
    setSaving(false);
    if (res.ok) {
      setNewName("");
      await load();
    }
  }

  async function saveFields() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/appointments/service-booking/intake-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, name: selected.name, fields }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Save failed");
      return;
    }
    setMessage("Saved");
    await load();
  }

  function addField(type: IntakeFieldType) {
    setFields((prev) => [
      ...prev,
      {
        id: createId(),
        label: type === "file" ? "Upload a file" : type === "image" ? "Upload an image" : "New question",
        type,
        required: false,
      },
    ]);
  }

  if (loading) return <p className="text-[13px] text-[#8a8fa3]">Loading intake forms…</p>;

  if (forms.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center">
        <h3 className="text-[15px] font-semibold text-[#1a1d29]">Collect the information you need before an appointment</h3>
        <p className="text-[13px] text-[#8a8fa3] mt-2">Create reusable intake forms customers complete when booking.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-sm mx-auto">
          <input
            className="flex-1 min-w-[180px] rounded-lg border px-3 py-2 text-[13px]"
            placeholder="Form name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="New intake form name"
          />
          <button
            type="button"
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg bg-[#5b4bff] px-4 py-2 text-[13px] font-semibold text-white"
            onClick={() => void createForm()}
          >
            <Plus size={14} /> Create intake form
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <input
          className="rounded-lg border px-3 py-2 text-[13px]"
          placeholder="New form name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          aria-label="New intake form name"
        />
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-[13px] font-medium"
          onClick={() => void createForm()}
        >
          <Plus size={14} /> Create intake form
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <ul className="divide-y rounded-xl border bg-white">
          {forms.map((form) => (
            <li key={form.id}>
              <button
                type="button"
                className={`w-full p-4 text-left text-[13px] ${
                  selectedId === form.id ? "bg-[#f7f8fb] font-semibold" : ""
                }`}
                onClick={() => setSelectedId(form.id)}
              >
                {form.name}
                <span className="block text-[11px] text-[#8a8fa3] font-normal mt-0.5">
                  {(form.fields || []).length} fields
                </span>
              </button>
            </li>
          ))}
        </ul>

        {selected ? (
          <div className="rounded-xl border bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[14px] font-semibold">{selected.name}</h2>
              <div className="flex flex-wrap gap-1">
                {FIELD_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    className="rounded border px-2 py-1 text-[11px]"
                    onClick={() => addField(type.value)}
                  >
                    + {type.label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="space-y-3">
              {fields.length === 0 ? (
                <li className="text-[13px] text-[#8a8fa3]">Add fields to this form.</li>
              ) : (
                fields.map((field, index) => (
                  <li key={field.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_140px_auto]">
                    <label className="flex flex-col gap-1 text-[12px]">
                      <span className="font-semibold text-[#6b6f82]">Label</span>
                      <input
                        className="rounded border px-2 py-1.5 text-[13px]"
                        value={field.label}
                        onChange={(e) =>
                          setFields((prev) =>
                            prev.map((f, i) => (i === index ? { ...f, label: e.target.value } : f)),
                          )
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px]">
                      <span className="font-semibold text-[#6b6f82]">Type</span>
                      <select
                        className="rounded border px-2 py-1.5 text-[13px]"
                        value={field.type}
                        onChange={(e) =>
                          setFields((prev) =>
                            prev.map((f, i) =>
                              i === index ? { ...f, type: e.target.value as IntakeFieldType } : f,
                            ),
                          )
                        }
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-end gap-2 pb-1 text-[12px]">
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
                  </li>
                ))
              )}
            </ul>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={saving}
                className="rounded-lg bg-[#5b4bff] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                onClick={() => void saveFields()}
              >
                {saving ? "Saving…" : "Save form"}
              </button>
              {message ? <span className="text-[12px] text-[#8a8fa3]">{message}</span> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
