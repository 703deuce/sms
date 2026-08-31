"use client";
import { useState } from "react";
import { ClipboardList, Info } from "lucide-react";
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
        <div className="tv-head-icon"><ClipboardList size={19} /></div>
        <div>
          <h1 className="tv-title">Create Custom Field</h1>
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>Create a new custom field.</p>
        </div>
      </div>
      <div className="tv-form-card">
        <label className="tv-label">Field Name</label>
        <input className="tv-input" style={{ width: "100%", minWidth: 0 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Preferred Location" />

        <label className="tv-label">Data Type</label>
        <div className="tv-select-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="tv-select" style={{ width: "100%", textAlign: "left", color: type ? "inherit" : "var(--tv-muted)" }} onClick={() => setOpen(!open)}>
              {type || "Select an Option..."}
            </button>
            <Info size={15} style={{ color: "#9aa0b4", flexShrink: 0 }} />
          </div>
          {open && (
            <div className="tv-options">
              <button onClick={() => { setType(""); setOpen(false); }}>✓ Select an Option...</button>
              {dataTypeOptions.map((o) => (
                <button key={o} onClick={() => { setType(o); setOpen(false); }}>{o}</button>
              ))}
            </div>
          )}
        </div>

        <label className="tv-label">Description</label>
        <textarea className="tv-textarea" style={{ width: "100%", minHeight: 96, resize: "vertical" }} value={desc} onChange={(e) => setDesc(e.target.value)} />

        <div className="tv-form-actions">
          <button className="tv-btn tv-btn-primary" style={{ minWidth: 110 }} disabled={!name || !type} onClick={() => onSave(name, type as FieldType, desc)}>Save</button>
          <button className="tv-btn tv-btn-ghost" style={{ minWidth: 110 }} onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
}
