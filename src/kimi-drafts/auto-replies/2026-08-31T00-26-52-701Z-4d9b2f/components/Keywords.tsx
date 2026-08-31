"use client";
import React, { useState } from "react";
import { Search, MoreVertical, Pencil, QrCode, MousePointerClick, Trash2, ListChecks, ArrowLeft, ChevronDown } from "lucide-react";
import { keywords as initKeywords, Keyword, COMPLIANCE_FOOTER } from "../mock-data";
import { PhonePreview, MessageEditor } from "./Shared";

export default function Keywords({ onSave }: { onSave: () => void }) {
  const [items, setItems] = useState<Keyword[]>(initKeywords);
  const [editing, setEditing] = useState<Keyword | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  if (editing) {
    return (
      <KeywordEditor
        keyword={editing}
        onCancel={() => setEditing(null)}
        onSave={(k) => {
          setItems((p) => p.map((x) => (x.id === k.id ? k : x)));
          setEditing(null);
          onSave();
        }}
      />
    );
  }

  const filtered = items.filter(
    (k) =>
      k.keyword.toLowerCase().includes(query.toLowerCase()) ||
      k.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">Keywords</h2>
          <p className="mt-1 text-[13px] tv-muted">
            Each keyword has its own auto-response. Editing it here overrides the default Opt-In Message for that opt-in method.
          </p>
        </div>
        <button className="tv-btn-primary" style={{ padding: "10px 20px" }}>Create Keyword</button>
      </div>

      <div className="relative mt-5 mb-3" style={{ maxWidth: 260, marginLeft: "auto" }}>
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 tv-muted" />
        <input className="tv-input" style={{ paddingLeft: 34 }} placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="tv-card overflow-visible">
        <table className="tv-table">
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Description</th>
              <th style={{ width: 90 }}>Creates Contacts</th>
              <th style={{ width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((k) => (
              <tr key={k.id}>
                <td>
                  <div className="font-semibold">{k.keyword}</div>
                  <div className="text-xs tv-muted mt-0.5">Last saved on {k.lastSaved}</div>
                </td>
                <td>
                  <div className="text-[13px]">{k.description}</div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs tv-muted">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "#eef1fd" }}>
                      <ListChecks size={11} color="#4f46e5" />
                    </span>
                    {k.connectedLists} Connected List{k.connectedLists === 1 ? "" : "s"}
                  </div>
                </td>
                <td>{k.createsContacts && <span className="tv-pill">Yes</span>}</td>
                <td>
                  <div className="relative">
                    <button className="tv-icon-btn" onClick={() => setMenuFor(menuFor === k.id ? null : k.id)}>
                      <MoreVertical size={15} />
                    </button>
                    {menuFor === k.id && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setMenuFor(null)} />
                        <div className="tv-menu">
                          <button className="tv-menu-item" onClick={() => { setEditing(k); setMenuFor(null); }}>
                            <Pencil size={14} /> Edit
                          </button>
                          <button className="tv-menu-item"><QrCode size={14} /> Create QR Code</button>
                          <button className="tv-menu-item"><MousePointerClick size={14} /> Create Tap-to-Join Link</button>
                          <button className="tv-menu-item" style={{ color: "#dc2626" }}><Trash2 size={14} /> Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <select className="tv-select">
          <option>25 Per Page</option>
          <option>50 Per Page</option>
        </select>
      </div>
    </div>
  );
}

function KeywordEditor({ keyword, onSave, onCancel }: { keyword: Keyword; onSave: (k: Keyword) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(keyword);

  return (
    <div>
      <button className="mb-3 flex items-center gap-1.5 text-[13px] font-medium tv-muted hover:text-[#4f46e5]" onClick={onCancel}>
        <ArrowLeft size={14} /> Tools / Keywords / {keyword.keyword}
      </button>
      <div className="flex items-start justify-between gap-10">
        <div className="flex-1 max-w-[560px]">
          <h2 className="text-xl font-bold">Edit Keyword</h2>
          <p className="mt-1 mb-5 text-[13px] tv-muted">Edit your keyword and associated settings.</p>

          <div className="tv-acc" style={{ marginBottom: 16 }}>
            <div className="tv-acc-head" style={{ cursor: "default" }}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "#4f46e5" }}>i</span>
              <span className="flex-1 text-sm font-semibold">Setup</span>
              <ChevronDown size={16} className="tv-muted" style={{ transform: "rotate(180deg)" }} />
            </div>
            <div className="tv-acc-body">
              <label className="tv-label">Keyword</label>
              <input className="tv-input mb-4" value={draft.keyword} onChange={(e) => setDraft({ ...draft, keyword: e.target.value })} />
              <label className="tv-label">Description</label>
              <input className="tv-input mb-4" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <MessageEditor
                label="Auto Response"
                value={draft.autoResponse}
                onChange={(v) => setDraft({ ...draft, autoResponse: v })}
              />
            </div>
          </div>

          <div className="tv-acc">
            <div className="tv-acc-head">
              <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "#eef1fd", color: "#4f46e5", fontSize: 11, fontWeight: 700 }}>2</span>
              <span className="flex-1 text-sm font-semibold">Contact Behavior</span>
              <ChevronDown size={16} className="tv-muted" />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button className="tv-btn-primary" onClick={() => onSave(draft)}>Save</button>
            <button className="tv-btn-ghost" onClick={onCancel}>Cancel</button>
          </div>
        </div>
        <div className="hidden lg:block pt-10">
          <PhonePreview keyword={draft.keyword} message={draft.autoResponse} footer={COMPLIANCE_FOOTER} />
        </div>
      </div>
    </div>
  );
}
