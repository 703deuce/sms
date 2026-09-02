"use client";
import Link from "next/link";
import { ArrowLeft, Search, Users, Download, MoreVertical, SearchX } from "lucide-react";
import { useState } from "react";
import { Segment, contacts as mockContacts, type Contact } from "../mock-data";
import { downloadContactsCsv } from "@/lib/contacts/download-csv";
import { PieSlice } from "./SegmentsList";

export default function SegmentContacts({
  segment,
  onBack,
  onEdit,
  contacts: contactsProp,
}: {
  segment: Segment;
  onBack: () => void;
  onEdit: () => void;
  contacts?: Contact[];
}) {
  const [q, setQ] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const source = contactsProp !== undefined ? contactsProp : mockContacts;
  const filtered = source.filter(c => `${c.firstName} ${c.lastName} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  const total = segment.contacts || source.length;

  const exportContacts = () => {
    const slug = segment.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "segment";
    downloadContactsCsv(
      filtered.map((c) => ({
        firstName: c.firstName,
        lastName: c.lastName,
        mobile: c.phone,
        email: c.email,
        optIn: c.status,
      })),
      `${slug}-contacts.csv`,
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-primary mb-3 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Segments
      </button>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full border-2 border-primary flex items-center justify-center shrink-0"><PieSlice /></div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground truncate">{segment.name}</h1>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={exportContacts}
            disabled={filtered.length === 0}
            className="h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-muted/70 text-sm font-medium text-foreground flex items-center gap-2 transition-colors shadow-sm disabled:pointer-events-none disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={onEdit} className="seg-btn-primary h-9 px-4 rounded-lg text-sm font-semibold transition-all duration-150 active:scale-[0.98]">
            Edit Segment
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-5 ml-12 flex items-center gap-1.5">
        <Users className="h-4 w-4" />
        <span className="tabular-nums font-medium text-foreground">{total.toLocaleString()}</span> matched contacts · updates dynamically
      </p>

      <div className="relative w-72 mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search contacts"
          className="seg-input w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <div className="seg-card rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[160px_1fr_1fr_120px_80px_120px_40px] gap-3 px-4 py-2.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          <span>Phone</span><span>Name</span><span>Email</span><span>State</span><span>Age</span><span>Status</span><span></span>
        </div>
        {filtered.map(c => (
          <div key={c.id} className="seg-row grid grid-cols-[160px_1fr_1fr_120px_80px_120px_40px] gap-3 px-4 py-3 border-t border-border first:border-t-0 items-center text-sm transition-colors hover:bg-muted/40">
            <Link href={`/contacts/${c.id}`} className="font-medium text-primary tabular-nums hover:underline">
              {c.phone}
            </Link>
            <Link href={`/contacts/${c.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
              {c.firstName} {c.lastName}
            </Link>
            <span className="text-muted-foreground truncate">{c.email}</span>
            <span className="text-muted-foreground">{c.state}</span>
            <span className="text-muted-foreground tabular-nums">{c.age ?? "—"}</span>
            <span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${
                c.status === "Subscribed"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-muted text-muted-foreground ring-border"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${c.status === "Subscribed" ? "bg-emerald-500" : "bg-slate-400"}`} />
                {c.status}
              </span>
            </span>
            <div className="relative">
              <button
                type="button"
                className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
                onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
              >
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
              {menuFor === c.id && (
                <div className="absolute right-0 top-8 z-10 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-lg text-sm">
                  <Link
                    href={`/contacts/${c.id}`}
                    className="block px-3 py-2 hover:bg-muted"
                    onClick={() => setMenuFor(null)}
                  >
                    View contact
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-14 border-t border-border flex flex-col items-center text-center">
            <span className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center mb-3">
              <SearchX className="h-5 w-5 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium text-foreground">No contacts found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">No contacts in this segment match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
