"use client";
import { useState } from "react";
import { ClipboardList, Info, Check, ChevronDown } from "lucide-react";
import { dataTypeOptions, FieldType } from "../mock-data";

export default function CreateFieldForm({
  onSave, onBack,
}: { onSave: (name: string, type: FieldType, desc: string) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType | "">("");
  const [desc, setDesc] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="tv-breadcrumb">Settings <span className="tv-crumb-sep">/</span> Custom Fields <span className="tv-crumb-sep">/</span> <span className="tv-crumb-current">Create Field</span></div>
      <div className="tv-page-head">
        <div className="tv-head-icon"><ClipboardList size={17} /></div>
        <div>
          <h1 className="tv-title">Create Custom Field</h1>
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>Create a new custom field to store on contact profiles.</p>
        </div>
      </div>
      <div className="tv-form-card" style={{ marginTop: 20 }}>
        <div className="tv-field-group">
          <label className="tv-label" style={{ marginTop: 0 }}>Field Name</label>
          <input className="tv-input tv-input-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Preferred Location" />
        </div>

        <div className="tv-field-group">
          <label className="tv-label">Data Type</label>
          <div className="tv-select-wrap">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" className="tv-select tv-select-full tv-select-btn" style={{ color: type ? "inherit" : "#9aa0b8" }} onClick={() => setOpen(!open)}>
                <span>{type || "Select an Option..."}</span>
                <ChevronDown size={14} style={{ color: "#9aa0b8", transition: "transform 150ms", transform: open ? "rotate(180deg)" : "none" }} />
              </button>
              <Info size={15} style={{ color: "#a3a8bf", flexShrink: 0 }} />
            </div>
            {open && (
              <div className="tv-options">
                <button onClick={() => { setType(""); setOpen(false); }} className={!type ? "selected" : ""}>
                  Select an Option... {!type && <Check size={13} />}
                </button>
                {dataTypeOptions.map((o) => (
                  <button key={o} className={type === o ? "selected" : ""} onClick={() => { setType(o); setOpen(false); }}>
                    {o} {type === o && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="tv-field-group">
          <label className="tv-label">Description</label>
          <textarea className="tv-textarea tv-input-full" style={{ minHeight: 96, resize: "vertical" }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description of what this field stores" />
        </div>

        <div className="tv-form-actions">
          <button className="tv-btn tv-btn-primary" style={{ minWidth: 110 }} disabled={!name || !type} onClick={() => onSave(name, type as FieldType, desc)}>Save</button>
          <button className="tv-btn tv-btn-ghost" style={{ minWidth: 110 }} onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
}
