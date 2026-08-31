"use client";
import { useEffect, useRef, useState } from "react";
import {
  Users, UserCheck, UserX, Search, SlidersHorizontal, ChevronDown,
  UserPlus, Upload, ArrowUpDown, Info,
} from "lucide-react";
import { contacts as seedContacts, stats as seedStats } from "../mock-data";

function StatCard({ icon: Icon, label, value, tint }: { icon: any; label: string; value: string; tint: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tint}`}>
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-[13px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
          {label} <Info className="w-3 h-3 opacity-60" />
        </span>
        <span className="text-[22px] font-bold tracking-tight text-foreground">{value}</span>
      </div>
    </div>
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
    <div className="px-8 pt-6 pb-10">
      {savedToast && (
        <div className="fixed top-5 right-6 z-40 flex items-center gap-2 bg-emerald-600 text-white text-[13px] font-medium px-4 py-2.5 rounded-lg shadow-lg shadow-emerald-600/20">
          <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
          Contact saved.
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-foreground" />
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">Contacts</h1>
      </div>
      <p className="text-[13px] text-muted-foreground mt-1 mb-6">View and manage all of your contacts.</p>

      {/* Stat row — airy, no card boxes, matches reference density */}
      <div className="flex items-center gap-16 mb-7">
        <StatCard icon={Users} label="Contacts" value={stats.contacts.toLocaleString()} tint="bg-indigo-50 text-indigo-600" />
        <StatCard icon={UserCheck} label="Subscribed Contacts" value={stats.subscribed.toLocaleString()} tint="bg-emerald-50 text-emerald-600" />
        <StatCard icon={UserX} label="Unsubscribed Contacts" value={String(stats.unsubscribed)} tint="bg-rose-50 text-rose-500" />
      </div>

      {/* Table surface */}
      <div className="kc-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <button className="kc-btn-secondary flex items-center gap-2 px-3 h-9 text-[13px]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" /> Filter
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 border border-border rounded-lg px-3 h-9 w-64 bg-card transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="kc-btn-primary flex items-center gap-1.5 pl-4 pr-3 h-9 text-[13px]"
              >
                Create Contact <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              {menuOpen && (
                <div className="kc-menu absolute right-0 mt-1.5 w-48 z-20 py-1.5">
                  <button
                    onClick={() => { setMenuOpen(false); onCreateOne(); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-foreground hover:bg-accent transition-colors"
                  >
                    <UserPlus className="w-4 h-4 text-muted-foreground" /> Create One
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onImportList(); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-foreground hover:bg-accent transition-colors"
                  >
                    <Upload className="w-4 h-4 text-muted-foreground" /> Import List
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="kc-table w-full text-[13px]">
            <thead>
              <tr className="text-left border-b border-border bg-muted/40">
                <th className="pl-4 pr-2 py-3 w-10"><input type="checkbox" className="kc-check" /></th>
                {["First Name", "Last Name", "Mobile Number", "Email", "Opt-In Status", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">
                      {h} <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="pl-4 pr-2 py-3"><input type="checkbox" className="kc-check" /></td>
                  <td className="px-4 py-3 text-primary font-medium">{c.firstName}</td>
                  <td className="px-4 py-3 text-foreground">{c.lastName}</td>
                  <td className="px-4 py-3 text-primary">{c.mobile}</td>
                  <td className="px-4 py-3 text-foreground">{c.email || <span className="text-muted-foreground/50">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`kc-pill ${c.status === "Subscribed" ? "kc-pill-sub" : c.status === "Unsubscribed" ? "kc-pill-unsub" : "kc-pill-neutral"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.created}</td>
                  <td className="px-4 py-3 text-muted-foreground/70">
                    <Info className="w-4 h-4 hover:text-foreground transition-colors cursor-pointer" />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[13px] text-muted-foreground">
                    No contacts match “{query}”.
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
