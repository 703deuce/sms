"use client";
import { Search, Plus, Users, MoreVertical } from "lucide-react";
import { useState } from "react";
import { lists } from "../mock-data";

export default function ListsList() {
  const [q, setQ] = useState("");
  const filtered = lists.filter(l => l.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <h1 className="text-2xl font-semibold text-foreground mb-1">Lists</h1>
      <p className="text-sm text-muted-foreground mb-6">View and manage all of your lists.</p>
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-72">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search"
            className="w-full h-9 rounded-md border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
        <button className="h-9 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" /> Create List</button>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_180px_180px_40px] gap-3 px-4 py-2.5 bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Name</span><span>Contacts</span><span>Created</span><span></span>
        </div>
        {filtered.map(l => (
          <div key={l.id} className="grid grid-cols-[1fr_180px_180px_40px] gap-3 px-4 py-3.5 border-t border-border items-center text-sm hover:bg-muted/40">
            <span className="font-medium text-foreground">{l.name}</span>
            <span className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-4 w-4" /> {l.contacts.toLocaleString()}</span>
            <span className="text-muted-foreground">{l.createdAt}</span>
            <button className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
