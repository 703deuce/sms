"use client";
import Link from "next/link";
import { useState } from "react";
import { Search, Plus, MoreVertical, Upload, SearchX } from "lucide-react";
import { contacts as mockContacts, type Contact } from "../mock-data";

function StatusChip({ status }: { status: Contact["status"] }) {
  const subscribed = status === "Subscribed";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${
        subscribed
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-muted text-muted-foreground ring-border"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${subscribed ? "bg-emerald-500" : "bg-slate-400"}`} />
      {status}
    </span>
  );
}

export default function ContactsList({ contacts: contactsProp }: { contacts?: Contact[] }) {
  const [q, setQ] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const source = contactsProp ?? mockContacts;
  const filtered = source.filter(c => `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground mb-1">Contacts</h1>
      <p className="text-sm text-muted-foreground mb-6">View and manage all of your contacts.</p>
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search contacts"
            className="seg-input w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="flex gap-2.5">
          <Link
            href="/contacts/imports"
            className="h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-muted/70 text-sm font-medium text-foreground flex items-center gap-2 transition-colors shadow-sm"
          >
            <Upload className="h-4 w-4" /> Import
          </Link>
          <Link
            href="/contacts/create"
            className="seg-btn-primary h-9 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-150 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Add Contact
          </Link>
        </div>
      </div>
      <div className="seg-card rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[160px_1fr_1fr_120px_120px_40px] gap-3 px-4 py-2.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          <span>Phone</span><span>Name</span><span>Email</span><span>State</span><span>Status</span><span></span>
        </div>
        {filtered.map(c => (
          <div key={c.id} className="seg-row grid grid-cols-[160px_1fr_1fr_120px_120px_40px] gap-3 px-4 py-3 border-t border-border first:border-t-0 items-center text-sm transition-colors hover:bg-muted/40">
            <Link href={`/contacts/${c.id}`} className="font-medium text-primary tabular-nums hover:underline">
              {c.phone}
            </Link>
            <Link href={`/contacts/${c.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
              {c.firstName} {c.lastName}
            </Link>
            <span className="text-muted-foreground truncate">{c.email}</span>
            <span className="text-muted-foreground">{c.state}</span>
            <span><StatusChip status={c.status} /></span>
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
            <p className="text-sm font-medium text-foreground">No contacts found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">No contacts match your search. Try a different name, phone number, or keyword.</p>
          </div>
        )}
      </div>
    </div>
  );
}
