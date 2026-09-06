"use client";
import { useState } from "react";
import { ClipboardList, Search, Pencil, Trash2, Copy, Plus, AlertCircle, RefreshCw } from "lucide-react";
import { CustomField } from "../mock-data";

const pillFor = (t: string) =>
  t === "Text" ? "tv-pill-green" : t === "Number" ? "tv-pill-purple" : t === "Date" ? "tv-pill-blue" : "tv-pill-amber";

export default function CustomFieldsList({
  fields, loading = false, error = null, onRetry, onCreate, onEdit, onDelete,
}: {
  fields: CustomField[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
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
      <div className="tv-breadcrumb">Contacts <span className="tv-crumb-sep">/</span> <span className="tv-crumb-current">Custom Fields</span></div>
      <div className="tv-page-head">
        <div className="tv-head-icon"><ClipboardList size={17} /></div>
        <div>
          <h1 className="tv-title">Custom Fields</h1>
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>
            Custom fields let you store additional data on contact profiles beyond the standard fields like name, mobile
            number, and email. Use them to segment contacts and personalize appointment reminders and messages.
          </p>
        </div>
      </div>
      <div className="tv-toolbar" style={{ marginTop: 20, justifyContent: "space-between" }}>
        <div className="tv-search">
          <Search size={14} className="tv-search-icon" />
          <input className="tv-input" placeholder="Search fields" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search custom fields" />
        </div>
        <button className="tv-btn tv-btn-primary" onClick={onCreate}><Plus size={15} />Create Field</button>
      </div>
      <div className="tv-table-card">
        <table className="tv-table">
          <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Custom contact fields</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: "26%" }}>Name</th>
              <th scope="col">Description</th>
              <th scope="col">Merge Tag</th>
              <th scope="col" style={{ width: 108 }}>Data Type</th>
              <th scope="col" style={{ width: 92 }}><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`skel-${i}`} aria-hidden="true">
                  <td><div className="tv-skeleton" style={{ width: "60%", height: 13 }} /><div className="tv-skeleton" style={{ width: "45%", height: 10, marginTop: 6 }} /></td>
                  <td><div className="tv-skeleton" style={{ width: "85%", height: 12 }} /></td>
                  <td><div className="tv-skeleton" style={{ width: 120, height: 22, borderRadius: 6 }} /></td>
                  <td><div className="tv-skeleton" style={{ width: 54, height: 18, borderRadius: 99 }} /></td>
                  <td />
                </tr>
              ))}
            {!loading && error && (
              <tr>
                <td colSpan={5}>
                  <div className="tv-empty">
                    <div className="tv-empty-icon" style={{ background: "var(--tv-red-bg)", color: "var(--tv-red)" }}><AlertCircle size={18} /></div>
                    <div className="tv-empty-title">Custom fields couldn’t be loaded</div>
                    <div className="tv-empty-sub">{error} Your existing fields were not changed.</div>
                    <button className="tv-btn tv-btn-ghost" style={{ marginTop: 14 }} onClick={onRetry}>
                      <RefreshCw size={13} />Retry
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {!loading && !error && filtered.map((f) => (
              <tr key={f.id}>
                <td>
                  <div className="tv-cell-strong">{f.name}</div>
                  <div className="tv-cell-sub">{f.created}</div>
                </td>
                <td>
                  {f.description ? (
                    <span className="tv-cell-desc">{f.description}</span>
                  ) : (
                    <button className="tv-link tv-link-muted" onClick={() => onEdit(f.id)}>
                      Add Description <Pencil size={12} />
                    </button>
                  )}
                </td>
                <td>
                  <button
                    className={`tv-merge ${copied === f.id ? "tv-merge-copied" : ""}`}
                    title={copied === f.id ? "Copied" : "Copy merge tag"}
                    onClick={() => copyTag(f.id, f.mergeTag)}
                  >
                    {copied === f.id ? "Copied" : f.mergeTag}
                    <Copy size={12} />
                  </button>
                </td>
                <td><span className={`tv-pill ${pillFor(f.type)}`}>{f.type}</span></td>
                <td className="tv-row-actions">
                  <button className="tv-icon-btn" title={`Edit ${f.name}`} aria-label={`Edit ${f.name}`} onClick={() => onEdit(f.id)}><Pencil size={14} /></button>
                  <button className="tv-icon-btn danger" title={`Delete ${f.name}`} aria-label={`Delete ${f.name}`} onClick={() => onDelete(f.id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="tv-empty">
                    <div className="tv-empty-icon"><ClipboardList size={18} /></div>
                    <div className="tv-empty-title">{q ? "No custom fields found" : "No custom fields yet"}</div>
                    <div className="tv-empty-sub">
                      {q
                        ? `No custom fields match “${q}”. Try a different search term.`
                        : "Custom fields store extra data on contact profiles. Create your first field to get started."}
                    </div>
                    {!q && (
                      <button className="tv-btn tv-btn-primary" style={{ marginTop: 14 }} onClick={onCreate}>
                        <Plus size={14} />Create Field
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="tv-table-footer">
          <span>{loading ? "Loading…" : `${filtered.length} field${filtered.length === 1 ? "" : "s"}`}</span>
          <select className="tv-select tv-select-sm" aria-label="Rows per page"><option>25 Per Page</option><option>50 Per Page</option></select>
        </div>
      </div>
    </div>
  );
}
