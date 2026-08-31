"use client";
import { useState } from "react";
import { ClipboardList, Search, Pencil, Trash2, Copy } from "lucide-react";
import { CustomField } from "../mock-data";

const pillFor = (t: string) =>
  t === "Text" ? "tv-pill-green" : t === "Number" ? "tv-pill-purple" : t === "Date" ? "tv-pill-blue" : "tv-pill-amber";

export default function CustomFieldsList({
  fields, onCreate, onDelete,
}: { fields: CustomField[]; onCreate: () => void; onDelete: (id: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = fields.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="tv-breadcrumb">Settings / Custom Fields</div>
      <div className="tv-page-head">
        <div className="tv-head-icon"><ClipboardList size={19} /></div>
        <h1 className="tv-title">Custom Fields</h1>
      </div>
      <p className="tv-subtitle">
        Custom fields allows you to store custom data on contact profiles in addition to the standard fields like first
        name, last name, email, etc. You can then segment your contacts on a granular level and target more specific
        groups with your campaigns.
      </p>
      <div className="tv-toolbar">
        <div style={{ position: "relative" }}>
          <input className="tv-input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingRight: 34 }} />
          <Search size={15} style={{ position: "absolute", right: 11, top: 10, color: "#9aa0b4" }} />
        </div>
        <button className="tv-btn tv-btn-primary" onClick={onCreate}>Create Field</button>
      </div>
      <table className="tv-table">
        <thead>
          <tr><th style={{ width: "30%" }}>Name</th><th>Description</th><th>Merge Tag</th><th style={{ width: 110 }}>Data Type</th><th style={{ width: 90 }} /></tr>
        </thead>
        <tbody>
          {filtered.map((f) => (
            <tr key={f.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{f.name}</div>
                <div style={{ fontSize: 12, color: "var(--tv-muted)", marginTop: 2 }}>{f.created}</div>
              </td>
              <td>
                {f.description ? f.description : (
                  <button className="tv-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--tv-muted)" }}>
                    Add Description <Pencil size={12} />
                  </button>
                )}
              </td>
              <td><span className="tv-merge">{f.mergeTag} <Copy size={13} style={{ color: "#9aa0b4", cursor: "pointer" }} /></span></td>
              <td><span className={`tv-pill ${pillFor(f.type)}`}>{f.type}</span></td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button className="tv-icon-btn" title="Edit Field"><Pencil size={15} /></button>
                <button className="tv-icon-btn" title="Delete Field" onClick={() => onDelete(f.id)}><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 14 }}>
        <select className="tv-select"><option>25 Per Page</option><option>50 Per Page</option></select>
      </div>
    </div>
  );
}
