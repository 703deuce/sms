"use client";
import { useState } from "react";
import { ClipboardList, Info, Check } from "lucide-react";
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
      <div className="tv-breadcrumb">Settings / Custom Fields / Create Field</div>
      <div className="tv-page-head">
        <div className="tv-head-icon"><ClipboardList size={18} /></div>
        <div>
          <h1 className="tv-title">Create Custom Field</h1>
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>Create a new custom field to store on contact profiles.</p>
        </div>
      </div>
      <div className="tv-form-card" style={{ marginTop: 18 }}>
        <label className="tv-label" style={{ marginTop: 0 }}>Field Name</label>
        <input className="tv-input" style={{ width: "100%", minWidth: 0 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Preferred Location" />

        <label className="tv-label">Data Type</label>
        <div className="tv-select-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="tv-select" style={{ width: "100%", textAlign: "left", color: type ? "inherit" : "#a0a4b8" }} onClick={() => setOpen(!open)}>
              {type || "Select an Option..."}
            </button>
            <Info size={15} style={{ color: "#a0a4b8", flexShrink: 0 }} />
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

        <label className="tv-label">Description</label>
        <textarea className="tv-textarea" style={{ width: "100%", minHeight: 96, resize: "vertical" }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description of what this field stores" />

        <div className="tv-form-actions">
          <button className="tv-btn tv-btn-primary" style={{ minWidth: 110 }} disabled={!name || !type} onClick={() => onSave(name, type as FieldType, desc)}>Save</button>
          <button className="tv-btn tv-btn-ghost" style={{ minWidth: 110 }} onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
}
