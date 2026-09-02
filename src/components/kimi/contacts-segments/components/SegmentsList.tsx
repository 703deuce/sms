"use client";
import { useEffect, useState } from "react";
import { Search, Users, MoreVertical, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { Segment, segments as initialSegments } from "../mock-data";

export default function SegmentsList({ segments: segmentsProp, onCreate, onViewContacts, onEdit, onDelete }: {
  segments?: Segment[];
  onCreate: () => void;
  onViewContacts: (s: Segment) => void;
  onEdit: (s: Segment) => void;
  onDelete?: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [items, setItems] = useState<Segment[]>(() => {
    if (segmentsProp) return segmentsProp;
    if (typeof window !== "undefined") {
      const saved = (window as any).__transovoSegments;
      if (saved) return saved;
    }
    return initialSegments;
  });

  useEffect(() => {
    if (segmentsProp) setItems(segmentsProp);
  }, [segmentsProp]);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);

  const filtered = items.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-9 w-9 rounded-full border-2 border-primary flex items-center justify-center">
          <PieSlice />
        </div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">Segments</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 ml-12">View and manage all of your segments.</p>

      <div className="flex items-center justify-between mb-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search segments"
            className="seg-input w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <button
          onClick={onCreate}
          className="seg-btn-primary h-9 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-150 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> Create Segment
        </button>
      </div>

      <div className="seg-card rounded-xl border border-border bg-card overflow-visible">
        <div className="grid grid-cols-[1fr_220px_160px_48px] gap-4 px-4 py-2.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground rounded-t-xl border-b border-border">
          <span>Name</span><span>Description</span><span>Contacts</span><span></span>
        </div>
        {filtered.map(s => (
          <div
            key={s.id}
            className="seg-row grid grid-cols-[1fr_220px_160px_48px] gap-4 px-4 py-3.5 border-t border-border first:border-t-0 items-center transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0">
              <button
                onClick={() => onEdit(s)}
                className="group text-sm font-medium text-foreground hover:text-primary flex items-center gap-1.5 transition-colors max-w-full"
              >
                <span className="truncate">{s.name}</span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
              <p className="text-xs text-muted-foreground mt-0.5">Created {s.createdAt}</p>
            </div>
            <button className="text-[13px] text-muted-foreground text-left truncate">
              {s.description?.trim() ? s.description : <span className="italic text-muted-foreground/70">—</span>}
            </button>
            <button
              onClick={() => onViewContacts(s)}
              className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 flex items-center justify-center transition-colors group-hover:bg-primary/15">
                <Users className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="font-semibold text-foreground tabular-nums group-hover:text-primary transition-colors">{s.contacts.toLocaleString()}</span>{" "}
                <span className="text-xs">contacts</span>
              </span>
            </button>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === s.id ? null : s.id); }}
                className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
              >
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
              {menuFor === s.id && (
                <div
                  className="absolute right-0 top-9 z-20 w-48 rounded-lg border border-border bg-card seg-dropdown seg-fade py-1 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button onClick={() => { setMenuFor(null); onViewContacts(s); }} className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2.5 transition-colors">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" /> View Contacts
                  </button>
                  <button onClick={() => { setMenuFor(null); onEdit(s); }} className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2.5 transition-colors">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit Segment
                  </button>
                  <div className="my-1 h-px bg-border" />
                  <button
                    onClick={() => { const next = items.filter(x => x.id !== s.id); setItems(next); (window as any).__transovoSegments = next; setMenuFor(null); onDelete?.(s.id); }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2.5 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-16 border-t border-border flex flex-col items-center text-center">
            <span className="h-12 w-12 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mb-3.5">
              <PieSlice />
            </span>
            <p className="text-sm font-medium text-foreground">{query ? "No segments found" : "No segments yet"}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
              {query
                ? "Try a different search term."
                : "Build dynamic segments from contact fields, lists, links and campaigns."}
            </p>
            {!query && (
              <button
                onClick={onCreate}
                className="seg-btn-primary mt-4 h-9 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-150 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" /> Create Segment
              </button>
            )}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground tabular-nums">
            {filtered.length} {filtered.length === 1 ? "segment" : "segments"}
          </p>
          <select className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30">
            <option>25 Per Page</option><option>50 Per Page</option><option>100 Per Page</option>
          </select>
        </div>
      )}
    </div>
  );
}

export function PieSlice() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="#4f46e5" strokeWidth="2" />
      <path d="M12 3 A9 9 0 0 1 20.7 9 L12 12 Z" fill="#2dd4bf" />
      <path d="M12 3 A9 9 0 0 0 4.5 16.5 L12 12 Z" fill="#6366f1" opacity="0.35" />
    </svg>
  );
}
