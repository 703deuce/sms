"use client";

import { useState } from "react";
import { PieChart, Search, Download, MoreVertical } from "lucide-react";
import { Segment, matchedContacts } from "../mock-data";

export default function SegmentContacts({ segment, onBack }: { segment: Segment; onBack: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = matchedContacts.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query)
  );

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <p className="text-xs text-muted-foreground">
        <button onClick={onBack} className="hover:text-indigo-600">Segments</button>
        <span className="mx-1">/</span> {segment.name}
      </p>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
          <PieChart className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{segment.name}</h1>
          <p className="text-sm text-muted-foreground">{segment.contacts.toLocaleString()} contacts match this segment.</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts"
            className="w-64 rounded-md border border-border bg-card py-2 pl-3 pr-9 text-sm outline-none focus:border-indigo-500"
          />
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <button className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1.2fr_1fr_1.4fr_0.8fr_0.5fr_1fr_40px] border-b border-border bg-muted/50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Name</span><span>Phone</span><span>Email</span><span>State</span><span>Age</span><span>Subscribed</span><span />
        </div>
        {filtered.map((c) => (
          <div key={c.id} className="seg-table-row grid grid-cols-[1.2fr_1fr_1.4fr_0.8fr_0.5fr_1fr_40px] items-center border-b border-border px-5 py-3 text-sm last:border-b-0">
            <span className="font-medium">{c.name}</span>
            <span className="text-muted-foreground">{c.phone}</span>
            <span className="truncate text-muted-foreground">{c.email}</span>
            <span>{c.state}</span>
            <span>{c.age ?? "—"}</span>
            <span className="text-muted-foreground">{c.subscribed}</span>
            <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><MoreVertical className="h-4 w-4" /></button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-14 text-center text-sm text-muted-foreground">No contacts found.</div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Showing {filtered.length} of {segment.contacts.toLocaleString()} contacts</p>
    </div>
  );
}
