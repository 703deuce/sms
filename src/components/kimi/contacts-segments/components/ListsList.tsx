"use client";
import { Search, Plus, Users, MoreVertical } from "lucide-react";
import { useState } from "react";
import { lists } from "../mock-data";

export default function ListsList() {
  const [q, setQ] = useState("");
  const filtered = lists.filter(l => l.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <h1 className="text-[22px] font-semibold tracking-tight text-foreground mb-1">Lists</h1>
      <p className="text-sm text-muted-foreground mb-6">View and manage all of your lists.</p>
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-72">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search"
            className="seg-input w-full h-9 rounded-lg border border-border bg-card pl-3 pr-9 text-sm" />
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <button className="seg-btn-primary h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" /> Create List</button>
      </div>
      <div className="seg-card rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_180px_180px_40px] gap-3 px-4 py-2.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          <span>Name</span><span>Contacts</span><span>Created</span><span></span>
        </div>
        {filtered.map(l => (
          <div key={l.id} className="seg-row grid grid-cols-[1fr_180px_180px_40px] gap-3 px-4 py-3.5 border-t border-border first:border-t-0 items-center text-sm">
            <span className="font-medium text-foreground">{l.name}</span>
            <span className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-4 w-4" /> <span className="tabular-nums">{l.contacts.toLocaleString()}</span></span>
            <span className="text-muted-foreground">{l.createdAt}</span>
            <button className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground border-t border-border">No lists match your search.</div>
        )}
      </div>
    </div>
  );
}
