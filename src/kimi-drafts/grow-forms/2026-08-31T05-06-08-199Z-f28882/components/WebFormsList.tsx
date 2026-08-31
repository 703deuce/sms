"use client";

import { useState } from "react";
import {
  Search, Plus, MoreVertical, Pencil, Code2, Copy, Trash2, ChevronDown,
  KeyRound, LayoutTemplate, MousePointerClick, Link2, QrCode, LayoutPanelTop, SlidersHorizontal,
} from "lucide-react";
import { WebForm } from "../mock-data";

const tools = [
  { icon: KeyRound, name: "Keywords", desc: "Establish keywords that users can text to join your lists or get automated replies." },
  { icon: LayoutTemplate, name: "Web Forms", desc: "Create fully branded web forms that capture visitor information and allow them to subscribe.", active: true },
  { icon: LayoutPanelTop, name: "Website Popups", desc: "Create fully branded website popups that capture visitor information and allow them to subscribe." },
  { icon: Link2, name: "Tap-to-Join Links", desc: "Tap-to-join links open a new message with your keyword and number pre-filled — hit send to subscribe." },
  { icon: QrCode, name: "QR Code Generator", desc: "Create QR codes that assist in texting keywords or sending people to URLs." },
  { icon: MousePointerClick, name: "Link Tracking", desc: "Shorten and track links in your messages to measure engagement." },
];

export default function WebFormsList({
  forms, onCreate, onEdit, onDelete,
}: {
  forms: WebForm[];
  onCreate: () => void;
  onEdit: (f: WebForm) => void;
  onDelete: (id: string) => void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const filtered = forms.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8" onClick={() => setMenuFor(null)}>
      {/* Breadcrumb + header */}
      <div className="text-[12px] text-gray-400 mb-1">Grow / Web Forms</div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-bold text-gray-900">
            <LayoutTemplate size={20} className="text-gray-700" /> Web Forms
          </h1>
          <p className="text-[13px] text-gray-500 mt-0.5">View and manage all of your web forms.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="tv-input !pl-8 !w-[220px]"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <button className="tv-btn-primary flex items-center gap-1.5" onClick={onCreate}>
            <Plus size={14} /> Create Web Form
          </button>
        </div>
      </div>

      {/* Audience growth tools strip */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {tools.slice(0, 3).map((t) => (
          <div key={t.name} className={`tv-card p-5 flex gap-4 ${t.active ? "ring-1 ring-indigo-200" : ""}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <t.icon size={18} />
            </div>
            <div>
              <div className="text-[13px] font-bold text-gray-900">{t.name}</div>
              <div className="text-[12px] text-gray-500 leading-snug mt-1">{t.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="tv-card mt-6 overflow-visible">
        <div className="grid grid-cols-[2fr_1.4fr_1fr_.8fr_.6fr_40px] gap-3 px-5 py-3 border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <span>Name</span><span>Description</span><span>Type</span><span></span><span>Status</span><span></span>
        </div>
        {filtered.map((f) => (
          <div
            key={f.id}
            className="grid grid-cols-[2fr_1.4fr_1fr_.8fr_.6fr_40px] gap-3 items-center px-5 py-4 border-b border-gray-50 hover:bg-gray-50/60"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-9 w-14 rounded shrink-0 border border-gray-200"
                style={{
                  background: `linear-gradient(135deg, ${f.thumb} 55%, ${f.thumb}cc 55%)`,
                }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 truncate">
                  {f.name} <Pencil size={11} className="text-gray-300 shrink-0" />
                </div>
                <div className="text-[11px] text-gray-400">Last saved on {f.lastSaved}</div>
              </div>
            </div>
            <div className="text-[12px] text-gray-500 truncate">
              {f.description || <span className="text-indigo-500 cursor-pointer hover:underline">Add Description</span>}
            </div>
            <div className="text-[12px] text-gray-600">{f.type}</div>
            <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-50 text-indigo-500"><SlidersHorizontal size={12} /></span>
              {f.lists} Connected List{f.lists === 1 ? "" : "s"}
            </div>
            <div><span className="tv-badge-active">{f.status}</span></div>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button className="tv-icon-btn" onClick={() => setMenuFor(menuFor === f.id ? null : f.id)}>
                <MoreVertical size={16} />
              </button>
              {menuFor === f.id && (
                <div className="absolute right-0 top-8 z-30 w-[190px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <div className="tv-drop-item" onClick={() => { setMenuFor(null); onEdit(f); }}><Pencil size={14} /> Edit</div>
                  <div className="tv-drop-item" onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); setMenuFor(null); }}>
                    <Code2 size={14} /> {copied ? "Copied!" : "Copy Embed Code"}
                  </div>
                  <div className="tv-drop-item"><Copy size={14} /> Clone</div>
                  <div className="tv-drop-item text-red-500" onClick={() => { onDelete(f.id); setMenuFor(null); }}><Trash2 size={14} /> Delete</div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="px-5 py-3">
          <button className="flex items-center gap-1 text-[12px] text-gray-500 border border-gray-200 rounded-md px-2 py-1.5">
            25 Per Page <ChevronDown size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
