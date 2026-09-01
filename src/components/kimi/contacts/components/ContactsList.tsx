"use client";
import { useEffect, useRef, useState } from "react";
import {
  Users, UserCheck, UserX, Search, SlidersHorizontal, ChevronDown,
  UserPlus, Upload, ArrowUpDown, Info, CheckCircle2,
} from "lucide-react";
import { contacts as seedContacts, stats as seedStats } from "../mock-data";

function StatCard({ icon: Icon, label, value, tint }: { icon: any; label: string; value: string; tint: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="flex items-center gap-1 whitespace-nowrap text-[13px] font-medium text-muted-foreground">
          {label} <Info className="h-3 w-3 opacity-50" />
        </span>
        <span className="font-display text-[22px] font-semibold tracking-tight text-foreground">{value}</span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "Subscribed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "Unsubscribed"
        ? "border-rose-200 bg-rose-50 text-rose-600"
        : "border-border bg-muted/60 text-muted-foreground";
  const dot =
    status === "Subscribed" ? "bg-emerald-500" : status === "Unsubscribed" ? "bg-rose-500" : "bg-muted-foreground/60";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

export default function ContactsList({
  contacts = seedContacts,
  stats = seedStats,
  onCreateOne,
  onImportList,
  savedToast,
}: {
  contacts?: typeof seedContacts;
  stats?: typeof seedStats;
  onCreateOne: () => void;
  onImportList: () => void;
  savedToast: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const filtered = contacts.filter((c) =>
    `${c.firstName} ${c.lastName} ${c.mobile} ${c.email}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="px-8 pb-10 pt-6">
      {savedToast && (
        <div className="fixed right-6 top-5 z-40 flex items-center gap-2.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-emerald-600/25 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="h-4 w-4" />
          Contact saved.
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users className="h-4 w-4" />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">Contacts</h1>
      </div>
      <p className="mb-6 mt-1 text-[13px] text-muted-foreground">View and manage all of your contacts.</p>

      {/* Stat row — airy, no card boxes */}
      <div className="mb-7 flex items-center gap-16">
        <StatCard icon={Users} label="Contacts" value={stats.contacts.toLocaleString()} tint="bg-indigo-50 text-indigo-600" />
        <StatCard icon={UserCheck} label="Subscribed Contacts" value={stats.subscribed.toLocaleString()} tint="bg-emerald-50 text-emerald-600" />
        <StatCard icon={UserX} label="Unsubscribed Contacts" value={String(stats.unsubscribed)} tint="bg-rose-50 text-rose-500" />
      </div>

      {/* Table surface */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <button className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" /> Filter
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-64 items-center gap-2 rounded-lg border border-border bg-card px-3 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts…"
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-primary pl-4 pr-3 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
              >
                Create Contact <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-20 mt-1.5 w-48 rounded-lg border border-border bg-card py-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => { setMenuOpen(false); onCreateOne(); }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] text-foreground transition-colors hover:bg-muted"
                  >
                    <UserPlus className="h-4 w-4 text-muted-foreground" /> Create One
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onImportList(); }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] text-foreground transition-colors hover:bg-muted"
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" /> Import List
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="w-10 py-2.5 pl-4 pr-2"><input type="checkbox" className="kc-check" /></th>
                {["First Name", "Last Name", "Mobile Number", "Email", "Opt-In Status", "Created"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[12px] font-semibold text-muted-foreground">
                    <span className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
                      {h} <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </span>
                  </th>
                ))}
                <th className="w-10 px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/30">
                  <td className="py-3 pl-4 pr-2"><input type="checkbox" className="kc-check" /></td>
                  <td className="px-4 py-3 font-medium text-primary">{c.firstName}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{c.lastName}</td>
                  <td className="px-4 py-3 tabular-nums text-primary">{c.mobile}</td>
                  <td className="px-4 py-3 text-foreground">{c.email || <span className="text-muted-foreground/50">—</span>}</td>
                  <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{c.created}</td>
                  <td className="px-4 py-3 text-muted-foreground/60">
                    <Info className="h-4 w-4 cursor-pointer transition-colors hover:text-foreground" />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <div className="mx-auto flex max-w-xs flex-col items-center">
                      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Search className="h-4.5 w-4.5 h-4 w-4" />
                      </span>
                      <p className="text-[13px] font-medium text-foreground">No contacts found</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">No contacts match “{query}”. Try a different search.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
