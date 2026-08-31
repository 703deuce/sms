"use client";
import { useState } from "react";
import { ClipboardList, Search, Pencil, Trash2, Copy, Plus } from "lucide-react";
import { CustomField } from "../mock-data";

const pillFor = (t: string) =>
  t === "Text" ? "tv-pill-green" : t === "Number" ? "tv-pill-purple" : t === "Date" ? "tv-pill-blue" : "tv-pill-amber";

export default function CustomFieldsList({
  fields, onCreate, onDelete,
}: { fields: CustomField[]; onCreate: () => void; onDelete: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const filtered = fields.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));

  const copyTag = (id: string, tag: string) => {
    try { navigator.clipboard?.writeText(tag); } catch { /* noop */ }
    setCopied(id);
    setTimeout(() => setCopied(null), 1400);
  };

  return (
    <div>
      <div className="tv-breadcrumb">Settings / Custom Fields</div>
      <div className="tv-page-head">
        <div className="tv-head-icon"><ClipboardList size={18} /></div>
        <div>
          <h1 className="tv-title">Custom Fields</h1>
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>
            Custom fields allow you to store custom data on contact profiles in addition to the standard fields like first
            name, last name, email, etc. You can then segment your contacts on a granular level and target more specific
            groups with your campaigns.
          </p>
        </div>
      </div>
      <div className="tv-toolbar" style={{ marginTop: 18 }}>
        <div className="tv-search">
          <Search size={14} className="tv-search-icon" />
          <input className="tv-input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="tv-btn tv-btn-primary" onClick={onCreate}><Plus size={15} />Create Field</button>
      </div>
      <table className="tv-table">
        <thead>
          <tr><th style={{ width: "28%" }}>Name</th><th>Description</th><th>Merge Tag</th><th style={{ width: 110 }}>Data Type</th><th style={{ width: 88 }} /></tr>
        </thead>
        <tbody>
          {filtered.map((f) => (
            <tr key={f.id}>
              <td>
                <div className="tv-cell-strong">{f.name}</div>
                <div className="tv-cell-sub">{f.created}</div>
              </td>
              <td style={{ color: f.description ? undefined : "var(--tv-muted)" }}>
                {f.description ? f.description : (
                  <button className="tv-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--tv-muted)", fontSize: 12.5 }}>
                    Add Description <Pencil size={12} />
                  </button>
                )}
              </td>
              <td>
                <span className="tv-merge">
                  {f.mergeTag}
                  <Copy
                    size={13}
                    style={{ color: copied === f.id ? "var(--tv-green)" : "#9aa0b4", cursor: "pointer" }}
                    onClick={() => copyTag(f.id, f.mergeTag)}
                  />
                </span>
              </td>
              <td><span className={`tv-pill ${pillFor(f.type)}`}>{f.type}</span></td>
              <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                <button className="tv-icon-btn" title="Edit Field"><Pencil size={15} /></button>
                <button className="tv-icon-btn danger" title="Delete Field" onClick={() => onDelete(f.id)}><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: "36px 16px", color: "var(--tv-muted)" }}>
                No custom fields match “{q}”.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="tv-table-footer">
        <span>{filtered.length} field{filtered.length === 1 ? "" : "s"}</span>
        <select className="tv-select" style={{ width: 120 }}><option>25 Per Page</option><option>50 Per Page</option></select>
      </div>
    </div>
  );
}
