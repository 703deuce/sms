"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, ScrollText, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractsAdminClient } from "@/components/appointments/contracts-admin-client";
import type { IntakeField, IntakeFieldType } from "@/lib/appointments/service-booking/types";
import { createId } from "@/lib/supabase/id";

const INTAKE_API = "/api/appointments/service-booking/intake-forms";

const INTAKE_FIELD_TYPES: Array<{ value: IntakeFieldType; label: string }> = [
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
  { value: "signature", label: "Signature" },
  { value: "agreement", label: "Agreement" },
];

type Tab = "intake" | "contracts" | "terms";

type IntakeFormRow = { id: string; name: string; active?: boolean; fields?: IntakeField[] };

function IntakeTemplatesSection() {
  const [forms, setForms] = useState<IntakeFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fields, setFields] = useState<IntakeField[]>([]);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(INTAKE_API);
      const json = await res.json();
      const rows = (json.data || []) as IntakeFormRow[];
      setForms(rows);
      if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = forms.find((f) => f.id === selectedId) || null;

  useEffect(() => {
    setFields(selected?.fields || []);
  }, [selected]);

  async function createForm() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    const res = await fetch(INTAKE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, fields: [] }),
    });
    setSaving(false);
    if (!res.ok) return;
    setNewName("");
    await load();
  }

  async function duplicateForm(form: IntakeFormRow) {
    setSaving(true);
    await fetch(INTAKE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${form.name} (copy)`, fields: form.fields || [] }),
    });
    setSaving(false);
    await load();
  }

  async function toggleActive(form: IntakeFormRow) {
    await fetch(INTAKE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: form.id, name: form.name, fields: form.fields || [], active: !form.active }),
    });
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

  async function saveFields() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch(INTAKE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, name: selected.name, fields, active: selected.active ?? true }),
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

  if (loading) {
    return <div className="avail-card p-6 animate-pulse h-48" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-[#8a87a0]">Collect information from customers before their appointment.</p>
        <Button size="sm" disabled={saving || !newName.trim()} onClick={() => void createForm()}>
          Create intake form
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[13px] flex-1 min-w-[200px]">
          <span className="font-medium">New form name</span>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. New client intake" />
        </label>
      </div>

      {forms.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-[#eceaf3] bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[#8a87a0] border-b border-[#eceaf3]">
                <th className="px-4 py-2 font-semibold" scope="col">Name</th>
                <th className="px-4 py-2 font-semibold" scope="col">Fields</th>
                <th className="px-4 py-2 font-semibold" scope="col">Status</th>
                <th className="px-4 py-2 font-semibold" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f1f7]">
              {forms.map((form) => (
                <tr key={form.id} className={selectedId === form.id ? "bg-[#f7f6ff]" : ""}>
                  <td className="px-4 py-3 font-medium">
                    <button type="button" className="text-left hover:underline" onClick={() => setSelectedId(form.id)}>
                      {form.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[#6b6880]">{form.fields?.length ?? 0}</td>
                  <td className="px-4 py-3">{form.active === false ? "Inactive" : "Active"}</td>
                  <td className="px-4 py-3">
                    <button type="button" className="text-[12px] text-[#5b4bff] hover:underline mr-2" onClick={() => setSelectedId(form.id)}>Edit</button>
                    <button type="button" className="text-[12px] text-[#5b4bff] hover:underline mr-2" onClick={() => void duplicateForm(form)}>Duplicate</button>
                    <button type="button" className="text-[12px] text-[#6b6880] hover:underline" onClick={() => void toggleActive(form)}>
                      {form.active === false ? "Activate" : "Disable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <ul className="divide-y rounded-xl border border-[#eceaf3] bg-white">
          {forms.length === 0 ? (
            <li className="p-4 text-[13px] text-[#8a87a0]">No intake templates yet.</li>
          ) : (
            forms.map((form) => (
              <li key={form.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className={`flex-1 p-3 text-left text-[13px] ${selectedId === form.id ? "bg-[#f7f6ff] font-medium" : ""}`}
                  onClick={() => setSelectedId(form.id)}
                >
                  {form.name}
                  {form.active === false ? <span className="text-[#8a87a0]"> (inactive)</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>

        {selected ? (
          <div className="avail-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[15px] font-bold">{selected.name}</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void duplicateForm(selected)}>Duplicate</Button>
                <Button size="sm" variant="outline" onClick={() => void toggleActive(selected)}>
                  {selected.active === false ? "Activate" : "Deactivate"}
                </Button>
              </div>
            </div>
            <p className="text-[12px] text-[#8a87a0]">
              Assign templates from a Service editor. File and image fields accept common formats; size limits follow your workspace policy.
            </p>
            <div className="flex flex-wrap gap-2">
              {INTAKE_FIELD_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className="rounded-lg border border-[#eceaf3] px-2 py-1 text-[11px] hover:bg-[#f7f6fb]"
                  onClick={() => addField(type.value)}
                >
                  + {type.label}
                </button>
              ))}
            </div>
            <ul className="space-y-2">
              {fields.length === 0 ? (
                <li className="text-[13px] text-[#8a87a0]">Add fields to build this form.</li>
              ) : (
                fields.map((field, index) => (
                  <li key={field.id} className="grid gap-2 rounded-lg border border-[#eceaf3] p-3 sm:grid-cols-[1fr_140px_auto]">
                    <input
                      className="input text-[13px]"
                      value={field.label}
                      onChange={(e) =>
                        setFields((prev) => prev.map((f, i) => (i === index ? { ...f, label: e.target.value } : f)))
                      }
                    />
                    <select
                      className="input text-[13px]"
                      value={field.type}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f, i) => (i === index ? { ...f, type: e.target.value as IntakeFieldType } : f)),
                        )
                      }
                    >
                      {INTAKE_FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-[12px]">
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
            <Button size="sm" disabled={saving} onClick={() => void saveFields()}>
              {saving ? "Saving…" : "Save template"}
            </Button>
            {message ? <p className="text-[12px] text-[#6b6f82]">{message}</p> : null}
          </div>
        ) : (
          <div className="avail-card p-8 text-[13px] text-[#8a87a0]">Select or create a template.</div>
        )}
      </div>
    </div>
  );
}

function TermsSection() {
  const [termsVersion, setTermsVersion] = useState("1.0");
  const [termsText, setTermsText] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data || {};
        setTermsVersion(String(data.termsVersion || "1.0"));
        setTermsText(String(data.termsText || data.termsAcceptanceText || ""));
        setUpdatedAt(data.updatedAt || null);
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termsVersion, termsText, termsAcceptanceText: termsText }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Save failed");
      return;
    }
    setMessage("Terms saved — current version for new bookings");
    setUpdatedAt(new Date().toISOString());
  }

  return (
    <div className="avail-card p-5 space-y-4">
      <p className="text-[12px] text-[#8a87a0]">
        Reusable terms customers accept during public booking. Assign from Service → Policies & Documents.
      </p>
      <div className="rounded-lg bg-[#f7f6fb] border border-[#eceaf3] px-3 py-2 text-[12px]">
        <span className="font-medium">Current version:</span> {termsVersion}
        {updatedAt ? (
          <span className="text-[#8a87a0]">
            {" "}· Updated {new Date(updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </span>
        ) : null}
      </div>
      <label className="flex flex-col gap-1 text-[13px]">
        <span className="font-medium">Version label</span>
        <input className="input" value={termsVersion} onChange={(e) => setTermsVersion(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        <span className="font-medium">Terms text</span>
        <textarea className="input min-h-[140px]" value={termsText} onChange={(e) => setTermsText(e.target.value)} />
      </label>
      <Button size="sm" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save terms"}
      </Button>
      {message ? <p className="text-[12px] text-[#6b6f82]">{message}</p> : null}
    </div>
  );
}

const TABS: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: "intake", label: "Intake templates", icon: ClipboardList },
  { id: "contracts", label: "Contract templates", icon: FileText },
  { id: "terms", label: "Terms", icon: ScrollText },
];

export function FormsDocumentsClient() {
  const [tab, setTab] = useState<Tab>("intake");

  return (
    <div className="avail-page min-h-full bg-[#f7f6fb] font-sans">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-8">
        <header className="mb-6">
          <h1 className="text-[22px] font-bold text-[#1a1830]">Forms & Documents</h1>
          <p className="text-[13px] text-[#8a87a0] mt-1">
            Intake forms, contracts, and terms used during booking and manage-appointment flows.
          </p>
        </header>

        <nav className="flex flex-wrap gap-2 mb-6" aria-label="Forms sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium border ${
                tab === id
                  ? "border-[#5b4bff] bg-[#f7f6ff] text-[#1a1830]"
                  : "border-[#eceaf3] bg-white text-[#6b6880] hover:bg-[#faf9fc]"
              }`}
              onClick={() => setTab(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {tab === "intake" ? <IntakeTemplatesSection /> : null}
        {tab === "contracts" ? (
          <div className="avail-card p-4">
            <ContractsAdminClient />
          </div>
        ) : null}
        {tab === "terms" ? <TermsSection /> : null}
      </div>
    </div>
  );
}
