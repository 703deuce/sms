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
      <div className="tv-breadcrumb">Settings <span className="tv-crumb-sep">/</span> <span className="tv-crumb-current">Custom Fields</span></div>
      <div className="tv-page-head">
        <div className="tv-head-icon"><ClipboardList size={17} /></div>
        <div>
          <h1 className="tv-title">Custom Fields</h1>
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>
            Custom fields allow you to store custom data on contact profiles in addition to the standard fields like first
            name, last name, email, etc. You can then segment your contacts on a granular level and target more specific
            groups with your campaigns.
          </p>
        </div>
      </div>
      <div className="tv-toolbar" style={{ marginTop: 20 }}>
        <div className="tv-search">
          <Search size={14} className="tv-search-icon" />
          <input className="tv-input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="tv-btn tv-btn-primary" onClick={onCreate}><Plus size={15} />Create Field</button>
      </div>
      <div className="tv-table-card">
        <table className="tv-table">
          <thead>
            <tr><th style={{ width: "27%" }}>Name</th><th>Description</th><th>Merge Tag</th><th style={{ width: 110 }}>Data Type</th><th style={{ width: 92 }} /></tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id}>
                <td>
                  <div className="tv-cell-strong">{f.name}</div>
                  <div className="tv-cell-sub">{f.created}</div>
                </td>
                <td>
                  {f.description ? (
                    <span className="tv-cell-desc">{f.description}</span>
                  ) : (
                    <button className="tv-link tv-link-muted">
                      Add Description <Pencil size={12} />
                    </button>
                  )}
                </td>
                <td>
                  <button
                    className={`tv-merge ${copied === f.id ? "tv-merge-copied" : ""}`}
                    title="Copy merge tag"
                    onClick={() => copyTag(f.id, f.mergeTag)}
                  >
                    {f.mergeTag}
                    <Copy size={12} />
                  </button>
                </td>
                <td><span className={`tv-pill ${pillFor(f.type)}`}>{f.type}</span></td>
                <td className="tv-row-actions">
                  <button className="tv-icon-btn" title="Edit Field"><Pencil size={14} /></button>
                  <button className="tv-icon-btn danger" title="Delete Field" onClick={() => onDelete(f.id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="tv-empty">
                    <div className="tv-empty-icon"><ClipboardList size={18} /></div>
                    <div className="tv-empty-title">No custom fields found</div>
                    <div className="tv-empty-sub">No custom fields match “{q}”. Try a different search term.</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="tv-table-footer">
          <span>{filtered.length} field{filtered.length === 1 ? "" : "s"}</span>
          <select className="tv-select tv-select-sm"><option>25 Per Page</option><option>50 Per Page</option></select>
        </div>
      </div>
    </div>
  );
}
