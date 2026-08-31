"use client";
import { Search, Plus, MoreVertical, Upload } from "lucide-react";
import { useState } from "react";
import { contacts as mockContacts, type Contact } from "../mock-data";

export default function ContactsList({ contacts: contactsProp }: { contacts?: Contact[] }) {
  const [q, setQ] = useState("");
  const source = contactsProp ?? mockContacts;
  const filtered = source.filter(c => `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <h1 className="text-[22px] font-semibold tracking-tight text-foreground mb-1">Contacts</h1>
      <p className="text-sm text-muted-foreground mb-6">View and manage all of your contacts.</p>
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-72">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search"
            className="seg-input w-full h-9 rounded-lg border border-border bg-card pl-3 pr-9 text-sm" />
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className="flex gap-2">
          <button className="h-9 px-3 rounded-lg border border-border bg-card hover:bg-muted text-sm font-medium flex items-center gap-2 transition-colors"><Upload className="h-4 w-4" /> Import</button>
          <button className="seg-btn-primary h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" /> Add Contact</button>
        </div>
      </div>
      <div className="seg-card rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[160px_1fr_1fr_120px_120px_40px] gap-3 px-4 py-2.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          <span>Phone</span><span>Name</span><span>Email</span><span>State</span><span>Status</span><span></span>
        </div>
        {filtered.map(c => (
          <div key={c.id} className="seg-row grid grid-cols-[160px_1fr_1fr_120px_120px_40px] gap-3 px-4 py-3 border-t border-border first:border-t-0 items-center text-sm">
            <span className="font-medium text-indigo-700 tabular-nums">{c.phone}</span>
            <span className="font-medium text-foreground">{c.firstName} {c.lastName}</span>
            <span className="text-muted-foreground truncate">{c.email}</span>
            <span className="text-muted-foreground">{c.state}</span>
            <span><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${c.status === "Subscribed" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{c.status}</span></span>
            <button className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground border-t border-border">No contacts match your search.</div>
        )}
      </div>
    </div>
  );
}
