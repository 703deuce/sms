"use client";
import { useEffect, useState } from "react";
import { ClipboardList, Check, ChevronDown, AlertCircle } from "lucide-react";
import { dataTypeOptions, FieldType } from "../mock-data";

const typeHints: Record<FieldType, string> = {
  Text: "Free-form text, e.g. company name or preferred location.",
  Number: "Numeric values only, e.g. appointment count. Used for numeric segment comparisons.",
  Date: "A calendar date, e.g. birthdate. Entered with a date picker on contact profiles.",
  "Yes / No": "A true/false choice, e.g. VIP customer. Shown as a Yes / No selector on contact profiles.",
};

export default function CreateFieldForm({
  onSave,
  onBack,
  initialName = "",
  initialType = "" as FieldType | "",
  initialDesc = "",
  editingKey,
  error = null,
  onClearError,
}: {
  onSave: (name: string, type: FieldType, desc: string) => void;
  onBack: () => void;
  initialName?: string;
  initialType?: FieldType | "";
  initialDesc?: string;
  editingKey?: string;
  error?: string | null;
  onClearError?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<FieldType | "">(initialType);
  const [desc, setDesc] = useState(initialDesc);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setName(initialName);
    setType(initialType);
    setDesc(initialDesc);
  }, [initialName, initialType, initialDesc, editingKey]);

  const isEdit = Boolean(editingKey);
  const mergePreview = name.trim() ? `{{${name.trim().toLowerCase().replace(/\s+/g, "_")}}}` : "";

  return (
    <div>
      <div className="tv-breadcrumb">
        Contacts <span className="tv-crumb-sep">/</span> Custom Fields <span className="tv-crumb-sep">/</span>{" "}
        <span className="tv-crumb-current">{isEdit ? "Edit Field" : "Create Field"}</span>
      </div>
      <div className="tv-page-head">
        <div className="tv-head-icon"><ClipboardList size={17} /></div>
        <div>
          <h1 className="tv-title">{isEdit ? "Edit Custom Field" : "Create Custom Field"}</h1>
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>
            {isEdit ? "Update this custom field's settings." : "Create a new custom field to store on contact profiles."}
          </p>
        </div>
      </div>
      <div className="tv-form-card" style={{ marginTop: 20 }}>
        {error && (
          <div className="tv-alert-error" role="alert">
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}
        <div className="tv-field-group">
          <label className="tv-label" style={{ marginTop: 0 }} htmlFor="cf-name">Field Name</label>
          <input
            id="cf-name"
            className="tv-input tv-input-full"
            value={name}
            onChange={(e) => { setName(e.target.value); onClearError?.(); }}
            placeholder="e.g. Preferred Location"
            aria-invalid={Boolean(error)}
            aria-describedby={mergePreview ? "cf-merge-preview" : undefined}
          />
          {mergePreview && (
            <div id="cf-merge-preview" style={{ marginTop: 6, fontSize: 12, color: "var(--tv-muted)" }}>
              Merge tag: <code style={{ fontFamily: "ui-monospace, Menlo, monospace", background: "#f4f5fb", border: "1px solid var(--tv-border)", borderRadius: 5, padding: "1px 6px", fontSize: 11.5 }}>{mergePreview}</code>
            </div>
          )}
        </div>

        <div className="tv-field-group">
          <label className="tv-label" id="cf-type-label">Data Type</label>
          <div className="tv-select-wrap">
            <button
              type="button"
              className="tv-select tv-select-full tv-select-btn"
              style={{ color: type ? "inherit" : "#9aa0b8" }}
              onClick={() => setOpen(!open)}
              aria-labelledby="cf-type-label"
              aria-expanded={open}
              aria-haspopup="listbox"
            >
              <span>{type || "Select an Option..."}</span>
              <ChevronDown size={14} style={{ color: "#9aa0b8", transition: "transform 150ms", transform: open ? "rotate(180deg)" : "none" }} />
            </button>
            {open && (
              <div className="tv-options" role="listbox" aria-label="Data type options">
                <button role="option" aria-selected={!type} onClick={() => { setType(""); setOpen(false); }} className={!type ? "selected" : ""}>
                  Select an Option... {!type && <Check size={13} />}
                </button>
                {dataTypeOptions.map((o) => (
                  <button key={o} role="option" aria-selected={type === o} className={type === o ? "selected" : ""} onClick={() => { setType(o); setOpen(false); }}>
                    {o} {type === o && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--tv-muted)" }}>
            {type ? typeHints[type] : "Data type determines how values are entered and validated on contact profiles."}
          </div>
        </div>

        <div className="tv-field-group">
          <label className="tv-label" htmlFor="cf-desc">Description <span style={{ fontWeight: 400, color: "var(--tv-faint)" }}>— Optional</span></label>
          <textarea id="cf-desc" className="tv-textarea tv-input-full" style={{ minHeight: 96, resize: "vertical" }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description of what this field stores" />
        </div>

        <div className="tv-form-actions">
          <button className="tv-btn tv-btn-primary" style={{ minWidth: 110 }} disabled={!name.trim() || !type} onClick={() => onSave(name, type as FieldType, desc)}>
            {isEdit ? "Save Changes" : "Save"}
          </button>
          <button className="tv-btn tv-btn-ghost" style={{ minWidth: 110 }} onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
}
