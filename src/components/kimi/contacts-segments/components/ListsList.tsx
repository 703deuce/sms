"use client";
import { Search, Plus, Users, MoreVertical, SearchX, ListChecks } from "lucide-react";
import { useState } from "react";
import { lists as mockLists, type ContactList } from "../mock-data";

export default function ListsList({ lists: listsProp }: { lists?: ContactList[] }) {
  const [q, setQ] = useState("");
  const source = listsProp ?? mockLists;
  const filtered = source.filter(l => l.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground mb-1">Lists</h1>
      <p className="text-sm text-muted-foreground mb-6">View and manage all of your lists.</p>
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search lists"
            className="seg-input w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <button className="seg-btn-primary h-9 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-150 active:scale-[0.98]">
          <Plus className="h-4 w-4" /> Create List
        </button>
      </div>
      <div className="seg-card rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_180px_180px_40px] gap-3 px-4 py-2.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          <span>Name</span><span>Contacts</span><span>Created</span><span></span>
        </div>
        {filtered.map(l => (
          <div key={l.id} className="seg-row grid grid-cols-[1fr_180px_180px_40px] gap-3 px-4 py-3.5 border-t border-border first:border-t-0 items-center text-sm transition-colors hover:bg-muted/40">
            <span className="font-medium text-foreground flex items-center gap-2.5">
              <span className="h-7 w-7 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                <ListChecks className="h-3.5 w-3.5" />
              </span>
              {l.name}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4" /> <span className="tabular-nums font-medium text-foreground">{l.contacts.toLocaleString()}</span>
            </span>
            <span className="text-muted-foreground">{l.createdAt}</span>
            <button className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-14 border-t border-border flex flex-col items-center text-center">
            <span className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center mb-3">
              <SearchX className="h-5 w-5 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium text-foreground">No lists found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">No lists match your search. Try a different term.</p>
          </div>
        )}
      </div>
    </div>
  );
}
