import { useState } from "react";
import { Check, Copy, ExternalLink, Eye, Plus, Trash2 } from "lucide-react";
import type { RoutingForm, RoutingFormMeta } from "../types";
import RuleEditor from "./RuleEditor";
import PreviewModal from "./PreviewModal";

type Props = {
  form: RoutingForm;
  meta: RoutingFormMeta;
  workspaceSlug: string;
  saving: boolean;
  dirty: boolean;
  onChange: (form: RoutingForm) => void;
  onSave: (form: RoutingForm) => void;
  onDelete: (id: string) => void;
};

const fieldTypes = [
  { value: "text", label: "Short text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
] as const;

export default function FormEditor({ form, meta, workspaceSlug, saving, dirty, onChange, onSave, onDelete }: Props) {
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const analytics = meta.routingAnalytics[form.id];
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/routing/${workspaceSlug}/${form.slug}`;
  const { bookingTypes, staffMembers } = meta;

  function updateField(fi: number, patch: Partial<RoutingForm["fields"][number]>) {
    onChange({
      ...form,
      fields: form.fields.map((f, i) => (i === fi ? { ...f, ...patch } : f)),
    });
  }

  function addField() {
    onChange({
      ...form,
      fields: [
        ...form.fields,
        { id: `field_${Date.now()}`, label: "New question", type: "text", required: false },
      ],
    });
  }

  function removeField(fi: number) {
    onChange({ ...form, fields: form.fields.filter((_, i) => i !== fi) });
  }

  function copyUrl() {
    navigator.clipboard?.writeText(publicUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function openPublic() {
    if (form.active && workspaceSlug && form.slug) {
      window.open(publicUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setPreviewOpen(true);
  }

  function destLabel(id?: string) {
    if (!id) return "Unknown";
    return (
      bookingTypes.find((t) => t.id === id)?.name ||
      staffMembers.find((s) => s.id === id)?.name ||
      "External URL"
    );
  }

  const totalRoutes = analytics
    ? Object.values(analytics.routes).reduce((a, b) => a + b, 0)
    : 0;
  const conversionRate = analytics && analytics.views > 0
    ? Math.round((totalRoutes / analytics.views) * 100)
    : null;

  return (
    <div className="surface rounded-xl bg-card" style={{ padding: 20 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 className="font-display" style={{ fontSize: 16, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {form.name}
            </h2>
            <button
              className={`chip ${form.active ? "chip-active" : "chip-inactive"}`}
              style={{ border: "none", cursor: "pointer" }}
              onClick={() => onChange({ ...form, active: !form.active })}
              title={form.active ? "Click to deactivate" : "Click to activate"}
              aria-pressed={!!form.active}
            >
              {form.active ? "Active" : "Inactive"}
            </button>
            {dirty && (
              <span className="chip" style={{ background: "hsl(var(--warning) / 0.12)", color: "hsl(var(--warning))" }}>
                Unsaved changes
              </span>
            )}
          </div>
          {analytics ? (
            <p className="text-muted-foreground" style={{ fontSize: 12.5, margin: "4px 0 0" }}>
              {analytics.views} views · {totalRoutes} routed submissions
              {conversionRate !== null ? ` · ${conversionRate}% conversion` : ""}
            </p>
          ) : (
            <p className="text-muted-foreground" style={{ fontSize: 12.5, margin: "4px 0 0" }}>
              Not published yet — save to make this form live.
            </p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => onSave(form)} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Public URL */}
      <div style={{ marginBottom: 18 }}>
        <div className="section-label">Public link</div>
        <div className="url-preview">
          <code style={{ flex: 1 }}>{publicUrl}</code>
          <button className="btn btn-ghost btn-icon" onClick={copyUrl} aria-label="Copy link" title="Copy link">
            {copied ? <Check size={14} style={{ color: "hsl(var(--success))" }} /> : <Copy size={14} />}
          </button>
          <button className="btn btn-ghost btn-icon" onClick={openPublic} aria-label="Open public form" title="Open public form">
            <ExternalLink size={14} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => setPreviewOpen(true)} aria-label="Preview form" title="Preview form">
            <Eye size={14} />
          </button>
        </div>
        {!form.active && (
          <p className="text-muted-foreground" style={{ fontSize: 12, margin: "6px 0 0" }}>
            This form is inactive — the public link currently shows a “form unavailable” page to visitors.
          </p>
        )}
      </div>

      {/* Basics */}
      <div style={{ marginBottom: 20 }}>
        <div className="section-label">Basics</div>
        <div className="field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Form name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>URL slug</label>
            <input
              className="input"
              value={form.slug}
              onChange={(e) => onChange({ ...form, slug: e.target.value })}
            />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Headline</label>
          <input
            className="input"
            value={form.headline || ""}
            placeholder="How can we help you?"
            onChange={(e) => onChange({ ...form, headline: e.target.value })}
          />
          <p className="text-muted-foreground" style={{ fontSize: 12, margin: "4px 0 0" }}>
            Shown at the top of the public intake form.
          </p>
        </div>
      </div>

      {/* Fields */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div className="section-label" style={{ margin: 0 }}>Intake questions</div>
          <button className="btn btn-outline btn-sm" onClick={addField}>
            <Plus size={14} /> Add question
          </button>
        </div>
        {form.fields.map((field, fi) => (
          <div
            key={field.id}
            className="question-row"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 150px auto 32px",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <input
              className="input"
              value={field.label}
              onChange={(e) => updateField(fi, { label: e.target.value })}
              aria-label="Question label"
            />
            <select
              className="input"
              value={field.type === "company_size" || field.type === "industry" ? "select" : field.type}
              onChange={(e) => updateField(fi, { type: e.target.value as typeof field.type })}
              aria-label="Question type"
            >
              {fieldTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label
              className="text-muted-foreground"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, whiteSpace: "nowrap" }}
            >
              <input
                type="checkbox"
                checked={!!field.required}
                onChange={(e) => updateField(fi, { required: e.target.checked })}
              />
              Required
            </label>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => removeField(fi)}
              aria-label="Remove question"
              disabled={form.fields.length <= 1}
            >
              <Trash2 size={14} />
            </button>
            {field.type === "select" || field.type === "company_size" || field.type === "industry" ? (
              <input
                className="input"
                style={{ gridColumn: "1 / -1" }}
                placeholder="Options, comma-separated (e.g. Healthcare, Legal, Other)"
                value={(field.options || []).join(", ")}
                onChange={(e) =>
                  updateField(fi, {
                    options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                aria-label="Dropdown options"
              />
            ) : null}
          </div>
        ))}
      </div>

      {/* Rules */}
      <RuleEditor form={form} meta={meta} onChange={onChange} />

      {/* Analytics */}
      {analytics && (
        <div style={{ marginTop: 20 }}>
          <div className="section-label">Routing activity</div>
          <div className="rule-card" style={{ marginBottom: 0 }}>
            {form.rules.map((rule, ri) => {
              const count = analytics.routes[rule.id] || 0;
              const pct = totalRoutes ? Math.round((count / totalRoutes) * 100) : 0;
              return (
                <div key={rule.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, width: 56 }}>Rule {ri + 1}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: "hsl(var(--muted))", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "hsl(var(--primary))", borderRadius: 999 }} />
                  </div>
                  <span className="text-muted-foreground" style={{ fontSize: 12, width: 110, textAlign: "right" }}>
                    {count} → {destLabel(rule.destination.appointmentTypeId || rule.destination.staffId)}
                  </span>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, width: 56 }}>Fallback</span>
              <div style={{ flex: 1, height: 6, borderRadius: 999, background: "hsl(var(--muted))", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${totalRoutes ? Math.round(((analytics.routes.fallback || 0) / totalRoutes) * 100) : 0}%`,
                    height: "100%",
                    background: "hsl(var(--muted-foreground) / 0.5)",
                    borderRadius: 999,
                  }}
                />
              </div>
              <span className="text-muted-foreground" style={{ fontSize: 12, width: 110, textAlign: "right" }}>
                {analytics.routes.fallback || 0} → {destLabel(form.fallbackDestination?.appointmentTypeId || form.fallbackDestination?.staffId)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div style={{ marginTop: 24, borderTop: "1px solid hsl(var(--border))", paddingTop: 16 }}>
        <div className="section-label">Danger zone</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <p className="text-muted-foreground" style={{ fontSize: 12.5, margin: 0, maxWidth: 420 }}>
            Permanently delete this routing form. The public link will stop accepting submissions. Past routed appointments are not affected.
          </p>
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> Delete form
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" role="presentation" onClick={() => setConfirmDelete(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-form-title" className="font-display" style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>
              Delete “{form.name}”?
            </h3>
            <p className="text-muted-foreground" style={{ fontSize: 13, margin: "0 0 18px" }}>
              This permanently removes the form and its routing rules. The public link will stop working. This can't be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setConfirmDelete(false)} autoFocus>
                Keep form
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete(form.id);
                }}
              >
                Delete form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Public form preview */}
      {previewOpen && <PreviewModal form={form} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}
