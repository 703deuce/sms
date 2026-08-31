"use client";
import { useState } from "react";
import {
  Users, UserCheck, UserX, Search, SlidersHorizontal, ChevronDown,
  UserPlus, Upload, ArrowUpDown, Info,
} from "lucide-react";
import { contacts, stats } from "../mock-data";

function StatCard({ icon: Icon, label, value, tint }: { icon: any; label: string; value: string; tint: string }) {
  return (
    <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-3">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${tint}`}>
        <Icon className="w-4.5 h-4.5 w-4 h-4" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          {label} <Info className="w-3 h-3" />
        </span>
        <span className="text-xl font-bold text-foreground">{value}</span>
      </div>
    </div>
  );
}

export default function ContactsList({
  onCreateOne,
  onImportList,
  savedToast,
}: {
  onCreateOne: () => void;
  onImportList: () => void;
  savedToast: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = contacts.filter((c) =>
    `${c.firstName} ${c.lastName} ${c.mobile} ${c.email}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-8">
      {savedToast && (
        <div className="fixed top-5 right-6 z-40 bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
          Contact saved.
        </div>
      )}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 ml-12">View and manage all of your contacts.</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={Users} label="Contacts" value={stats.contacts.toLocaleString()} tint="bg-primary/10 text-primary" />
        <StatCard icon={UserCheck} label="Subscribed Contacts" value={stats.subscribed.toLocaleString()} tint="bg-emerald-100 text-emerald-600" />
        <StatCard icon={UserX} label="Unsubscribed Contacts" value={String(stats.unsubscribed)} tint="bg-rose-100 text-rose-600" />
      </div>

      <div className="bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent">
            <SlidersHorizontal className="w-4 h-4" /> Filter
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 w-64">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Search className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
              >
                Create Contact <ChevronDown className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-card border border-border rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={() => { setMenuOpen(false); onCreateOne(); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    <UserPlus className="w-4 h-4 text-muted-foreground" /> Create One
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onImportList(); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent"
                  >
                    <Upload className="w-4 h-4 text-muted-foreground" /> Import List
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-muted-foreground border-b border-border">
              <th className="px-4 py-3 w-10"><input type="checkbox" className="rounded" /></th>
              {["FIRST NAME", "LAST NAME", "MOBILE NUMBER", "EMAIL", "OPT-IN STATUS", "CREATED"].map((h) => (
                <th key={h} className="px-4 py-3">
                  <span className="flex items-center gap-1">{h} <ArrowUpDown className="w-3 h-3" /></span>
                </th>
              ))}
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                <td className="px-4 py-3"><input type="checkbox" className="rounded" /></td>
                <td className="px-4 py-3 text-primary font-medium">{c.firstName}</td>
                <td className="px-4 py-3 text-foreground">{c.lastName}</td>
                <td className="px-4 py-3 text-primary">{c.mobile}</td>
                <td className="px-4 py-3 text-foreground">{c.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                    c.status === "Subscribed" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.created}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <Info className="w-4 h-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
