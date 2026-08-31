"use client";

import { useState } from "react";
import { PieChart, Search, MoreVertical, Users, Pencil, Trash2, Eye, Plus } from "lucide-react";
import { initialSegments, Segment } from "../mock-data";

interface Props {
  onCreate: () => void;
  onEdit: (s: Segment) => void;
  onViewContacts: (s: Segment) => void;
}

export default function SegmentsList({ onCreate, onEdit, onViewContacts }: Props) {
  const [segments, setSegments] = useState(initialSegments);
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [perPage, setPerPage] = useState(25);

  const filtered = segments.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
            <PieChart className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Segments</h1>
            <p className="text-sm text-muted-foreground">View and manage all of your segments.</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex items-center justify-end gap-3">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-56 rounded-md border border-border bg-card py-2 pl-3 pr-9 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <button onClick={onCreate} className="btn-brand rounded-md px-4 py-2 text-sm font-semibold">
          Create Segment
        </button>
      </div>

      {/* Table */}
      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1.4fr_1.2fr_180px_48px] items-center border-b border-border bg-muted/50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Name</span>
          <span>Description</span>
          <span />
          <span />
        </div>
        {filtered.map((s) => (
          <div
            key={s.id}
            className="seg-table-row relative grid grid-cols-[1.4fr_1.2fr_180px_48px] items-center border-b border-border px-5 py-4 last:border-b-0"
          >
            <div>
              <button onClick={() => onEdit(s)} className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-indigo-600">
                {s.name}
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.created}</p>
            </div>
            <button className="flex items-center gap-1.5 text-left text-sm text-muted-foreground hover:text-indigo-600">
              <Plus className="h-3 w-3" /> Add Description
            </button>
            <button onClick={() => onViewContacts(s)} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50">
                <Users className="h-3.5 w-3.5" />
              </span>
              {s.contacts.toLocaleString()} Contacts
            </button>
            <div className="relative flex justify-end">
              <button
                onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}
                className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuFor === s.id && (
                <div className="dropdown-panel absolute right-0 top-9 z-20 w-44 rounded-md border border-border bg-card py-1 text-sm">
                  <button onClick={() => { setMenuFor(null); onEdit(s); }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted">
                    <Pencil className="h-3.5 w-3.5" /> Edit Segment
                  </button>
                  <button onClick={() => { setMenuFor(null); onViewContacts(s); }} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted">
                    <Eye className="h-3.5 w-3.5" /> View Contacts
                  </button>
                  <button
                    onClick={() => { setSegments(segments.filter((x) => x.id !== s.id)); setMenuFor(null); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-14 text-center text-sm text-muted-foreground">No segments found.</div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3">
        <select
          value={perPage}
          onChange={(e) => setPerPage(Number(e.target.value))}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
        >
          <option value={25}>25 Per Page</option>
          <option value={50}>50 Per Page</option>
          <option value={100}>100 Per Page</option>
        </select>
      </div>
    </div>
  );
}
