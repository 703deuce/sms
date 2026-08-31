"use client";
import { ArrowLeft, Search, Users, Download, MoreVertical } from "lucide-react";
import { useState } from "react";
import { Segment, contacts } from "../mock-data";
import { PieSlice } from "./SegmentsList";

export default function SegmentContacts({ segment, onBack, onEdit }: { segment: Segment; onBack: () => void; onEdit: () => void }) {
  const [q, setQ] = useState("");
  const filtered = contacts.filter(c => `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-indigo-700 mb-3">
        <ArrowLeft className="h-4 w-4" /> Back to Segments
      </button>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full border-2 border-indigo-600 flex items-center justify-center"><PieSlice /></div>
          <h1 className="text-2xl font-semibold text-foreground">{segment.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium flex items-center gap-2"><Download className="h-4 w-4" /> Export</button>
          <button onClick={onEdit} className="h-9 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">Edit Segment</button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-5 ml-12 flex items-center gap-1.5">
        <Users className="h-4 w-4" /> {segment.contacts.toLocaleString()} matched contacts · updates dynamically
      </p>

      <div className="relative w-72 mb-4">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search contacts"
          className="w-full h-9 rounded-md border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[160px_1fr_1fr_120px_80px_120px_40px] gap-3 px-4 py-2.5 bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Phone</span><span>Name</span><span>Email</span><span>State</span><span>Age</span><span>Status</span><span></span>
        </div>
        {filtered.map(c => (
          <div key={c.id} className="grid grid-cols-[160px_1fr_1fr_120px_80px_120px_40px] gap-3 px-4 py-3 border-t border-border items-center text-sm hover:bg-muted/40">
            <span className="font-medium text-indigo-700">{c.phone}</span>
            <span>{c.firstName} {c.lastName}</span>
            <span className="text-muted-foreground truncate">{c.email}</span>
            <span>{c.state}</span>
            <span>{c.age ?? "—"}</span>
            <span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === "Subscribed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{c.status}</span>
            </span>
            <button className="h-7 w-7 rounded hover:bg-muted flex items-center justify-center"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
