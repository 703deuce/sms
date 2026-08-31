"use client";
import { useState } from "react";
import { Search, Users, MoreVertical, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { Segment, segments as initialSegments } from "../mock-data";

export default function SegmentsList({ onCreate, onViewContacts, onEdit }: {
  onCreate: () => void;
  onViewContacts: (s: Segment) => void;
  onEdit: (s: Segment) => void;
}) {
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [items, setItems] = useState<Segment[]>(() => {
    if (typeof window !== "undefined") {
      const saved = (window as any).__transovoSegments;
      if (saved) return saved;
    }
    return initialSegments;
  });

  const filtered = items.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-9 w-9 rounded-full border-2 border-indigo-600 flex items-center justify-center">
          <PieSlice />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Segments</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 ml-12">View and manage all of your segments.</p>

      <div className="flex items-center justify-between mb-4">
        <div className="relative w-72">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search"
            className="w-full h-9 rounded-md border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <button onClick={onCreate} className="h-9 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> Create Segment
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-visible">
        <div className="grid grid-cols-[1fr_220px_160px_48px] gap-4 px-4 py-2.5 bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground rounded-t-lg">
          <span>Name</span><span>Description</span><span></span><span></span>
        </div>
        {filtered.map(s => (
          <div key={s.id} className="grid grid-cols-[1fr_220px_160px_48px] gap-4 px-4 py-3.5 border-t border-border items-center hover:bg-muted/40 transition-colors">
            <div>
              <button onClick={() => onEdit(s)} className="text-sm font-medium text-foreground hover:text-indigo-700 flex items-center gap-1.5">
                {s.name} <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
              <p className="text-xs text-muted-foreground mt-0.5">Created on {s.createdAt}</p>
            </div>
            <button className="text-sm text-muted-foreground italic hover:text-indigo-600 text-left flex items-center gap-1">
              Add Description <Pencil className="h-3 w-3" />
            </button>
            <button onClick={() => onViewContacts(s)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-indigo-700">
              <span className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center"><Users className="h-3.5 w-3.5" /></span>
              <span className="font-semibold text-foreground">{s.contacts.toLocaleString()}</span> Contacts
            </button>
            <div className="relative">
              <button onClick={() => setMenuFor(menuFor === s.id ? null : s.id)} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
              {menuFor === s.id && (
                <div className="absolute right-0 top-9 z-20 w-44 rounded-md border border-border bg-card seg-dropdown seg-fade py-1">
                  <button onClick={() => { setMenuFor(null); onViewContacts(s); }} className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> View Contacts</button>
                  <button onClick={() => { setMenuFor(null); onEdit(s); }} className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"><Pencil className="h-3.5 w-3.5" /> Edit Segment</button>
                  <button onClick={() => { const next = items.filter(x => x.id !== s.id); setItems(next); (window as any).__transovoSegments = next; setMenuFor(null); }} className="w-full px-3 py-2 text-sm text-left hover:bg-muted text-red-600 flex items-center gap-2"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground border-t border-border">No segments found.</div>
        )}
      </div>

      <div className="mt-4">
        <select className="h-9 rounded-md border border-border bg-card px-2 text-sm text-muted-foreground">
          <option>25 Per Page</option><option>50 Per Page</option><option>100 Per Page</option>
        </select>
      </div>
    </div>
  );
}

export function PieSlice() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" fill="none" stroke="#4f46e5" strokeWidth="2" />
      <path d="M12 3 A9 9 0 0 1 20.7 9 L12 12 Z" fill="#2dd4bf" />
      <path d="M12 3 A9 9 0 0 0 4.5 16.5 L12 12 Z" fill="#6366f1" opacity="0.35" />
    </svg>
  );
}
