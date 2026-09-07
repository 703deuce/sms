"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Plus, Route } from "lucide-react";
import type { RoutingForm } from "../types";
import { initialForms, industryOptions, companySizeOptions } from "../types";
import FormListPanel from "./FormListPanel";
import FormEditor from "./FormEditor";

function emptyForm(): RoutingForm {
  return {
    id: `rf_${Date.now()}`,
    name: "New routing form",
    slug: "new-form",
    active: false,
    headline: "How can we help you?",
    fields: [
      { id: "industry", label: "Industry", type: "select", required: true, options: industryOptions },
      { id: "company_size", label: "Company size", type: "select", required: true, options: companySizeOptions },
    ],
    rules: [
      {
        id: "rule_industry",
        priority: 1,
        logic: "and",
        conditions: [{ fieldId: "industry", operator: "equals", value: "Healthcare" }],
        destination: { appointmentTypeId: "" },
      },
    ],
    fallbackDestination: { externalUrl: "" },
  };
}

export default function RoutingFormsClient({ workspaceSlug }: { workspaceSlug: string }) {
  const [forms, setForms] = useState<RoutingForm[]>([]);
  const [selected, setSelected] = useState<RoutingForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [formsRes, typesRes, settingsRes] = await Promise.all([
        fetch("/api/appointments/routing-forms"),
        fetch("/api/appointments/types"),
        fetch("/api/appointments/settings"),
      ]);
      if (!formsRes.ok) throw new Error("load failed");
      const formsJson = await formsRes.json();
      const list = (formsJson.data || []) as RoutingForm[];
      setForms(list);
      setSelected((sel) => sel ?? list[0] ?? null);
      if (typesRes.ok) await typesRes.json();
      if (settingsRes.ok) await settingsRes.json();
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  async function save(form: RoutingForm) {
    setSaving(true);
    await fetch("/api/appointments/routing-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setDirty(false);
    setToast("Routing form saved.");
    await load();
  }

  function handleChange(form: RoutingForm) {
    setSelected(form);
    setDirty(true);
  }

  function handleNew() {
    if (dirty && !window.confirm("You have unsaved changes. Discard them and create a new form?")) return;
    const f = emptyForm();
    setForms((prev) => [...prev, f]);
    setSelected(f);
    setDirty(true);
  }

  function handleSelect(f: RoutingForm) {
    if (f.id === selected?.id) return;
    if (dirty && !window.confirm("You have unsaved changes. Discard them and switch forms?")) return;
    setSelected(f);
    setDirty(false);
  }

  function handleDelete(id: string) {
    setForms((prev) => {
      const next = prev.filter((f) => f.id !== id);
      setSelected(next[0] ?? null);
      return next;
    });
    setDirty(false);
    setToast("Routing form deleted.");
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 24px 48px" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Routing</h1>
          <p className="text-muted-foreground" style={{ fontSize: 14, margin: "4px 0 0" }}>
            Intake forms that route leads to the right booking type or team member based on their answers.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>
          <Plus size={16} /> New form
        </button>
      </div>

      {loading ? (
        <div className="routing-grid" style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 20 }}>
          <div className="skeleton" style={{ height: 220 }} />
          <div className="skeleton" style={{ height: 480 }} />
        </div>
      ) : loadError ? (
        <div className="surface rounded-xl bg-card" style={{ padding: "40px 24px", textAlign: "center" }}>
          <AlertTriangle size={26} style={{ color: "hsl(var(--warning))", marginBottom: 10 }} />
          <h3 className="font-display" style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>
            Routing forms couldn't be loaded
          </h3>
          <p className="text-muted-foreground" style={{ fontSize: 13, margin: "0 0 14px" }}>
            Your forms and rules are unchanged. Check your connection and try again.
          </p>
          <button className="btn btn-outline btn-sm" onClick={load}>
            Retry
          </button>
        </div>
      ) : (
        <div className="routing-grid" style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 20, alignItems: "start" }}>
          <FormListPanel
            forms={forms}
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            onNew={handleNew}
          />

          {selected ? (
            <FormEditor
              form={selected}
              workspaceSlug={workspaceSlug}
              saving={saving}
              dirty={dirty}
              onChange={handleChange}
              onSave={save}
              onDelete={handleDelete}
            />
          ) : (
            <div
              className="surface rounded-xl bg-card"
              style={{ padding: "48px 24px", textAlign: "center" }}
            >
              <Route size={28} style={{ color: "hsl(var(--muted-foreground))", marginBottom: 10 }} />
              <h3 className="font-display" style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>
                Select a routing form
              </h3>
              <p className="text-muted-foreground" style={{ fontSize: 13, margin: "0 0 14px" }}>
                Choose a form from the list, or create a new one to start routing leads.
              </p>
              <button className="btn btn-primary btn-sm" onClick={handleNew}>
                <Plus size={14} /> New form
              </button>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
