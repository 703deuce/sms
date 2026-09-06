"use client";
import { useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Search,
  ChevronDown,
  UserPlus,
  Upload,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import type { Contact, OptInStatus } from "../mock-data";

const STATUS_FILTERS: Array<{ value: OptInStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "Subscribed", label: "Subscribed" },
  { value: "Unsubscribed", label: "Unsubscribed" },
  { value: "Not Subscribed", label: "Not subscribed" },
  { value: "Blocked", label: "Blocked" },
];

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="kimi-card flex items-center gap-3 px-4 py-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-semibold tabular-nums leading-tight tracking-tight text-foreground">
          {value}
        </p>
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
        : status === "Blocked"
          ? "border-slate-300 bg-slate-100 text-slate-600"
          : "border-border bg-muted/60 text-muted-foreground";
  const dot =
    status === "Subscribed"
      ? "bg-emerald-500"
      : status === "Unsubscribed"
        ? "bg-rose-500"
        : status === "Blocked"
          ? "bg-slate-500"
          : "bg-muted-foreground/60";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

export default function ContactsList({
  contacts,
  stats,
  onCreateOne,
  onImportList,
  savedToast,
}: {
  contacts: Contact[];
  stats: { contacts: number; subscribed: number; unsubscribed: number };
  onCreateOne: () => void;
  onImportList: () => void;
  savedToast: boolean;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OptInStatus | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [contacts, query, statusFilter]);

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-12 pt-7 lg:px-8">
      {savedToast && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-700 kimi-anim-fade">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Contact saved.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">Contacts</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Manage the people tied to your appointments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCreateOne} className="kimi-btn-secondary h-9">
            <UserPlus className="h-3.5 w-3.5" />
            Add Contact
          </button>
          <button type="button" onClick={onImportList} className="kimi-btn-primary h-9">
            <Upload className="h-3.5 w-3.5" />
            Import Contacts
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label="Contacts" value={stats.contacts.toLocaleString()} tint="bg-primary/10 text-primary" />
        <StatCard icon={UserCheck} label="Subscribed" value={stats.subscribed.toLocaleString()} tint="bg-emerald-100 text-emerald-700" />
        <StatCard icon={UserX} label="Unsubscribed" value={stats.unsubscribed.toLocaleString()} tint="bg-rose-100 text-rose-600" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone, or email"
            className="kimi-input pl-8"
            aria-label="Search contacts"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
            className="kimi-btn-secondary h-10"
          >
            {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {filterOpen && (
            <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-border bg-card py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] kimi-anim-zoom">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => {
                    setStatusFilter(f.value);
                    setFilterOpen(false);
                  }}
                  className={`flex w-full items-center px-3.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-muted ${
                    statusFilter === f.value ? "text-primary" : "text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="kimi-card mt-4 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Inbox className="h-5 w-5" />
            </span>
            <p className="text-[14px] font-semibold text-foreground">
              {contacts.length === 0 ? "No contacts yet" : "No contacts match these filters"}
            </p>
            <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
              {contacts.length === 0
                ? "Contacts appear here when customers book or you add them manually."
                : "Try a different search or clear the status filter."}
            </p>
            {contacts.length === 0 && (
              <button type="button" onClick={onImportList} className="kimi-btn-primary mt-4 h-9">
                <Upload className="h-3.5 w-3.5" />
                Import Contacts
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </th>
                <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mobile
                </th>
                <th scope="col" className="hidden px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                  Email
                </th>
                <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th scope="col" className="hidden px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {(`${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`).toUpperCase() || "—"}
                      </span>
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {`${c.firstName} ${c.lastName}`.trim() || "Unknown"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[13px] tabular-nums text-muted-foreground">{c.mobile}</td>
                  <td className="hidden px-5 py-3 text-[13px] text-muted-foreground md:table-cell">{c.email || "—"}</td>
                  <td className="px-5 py-3">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="hidden px-5 py-3 text-[12px] text-muted-foreground lg:table-cell">{c.created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-[12px] text-muted-foreground">
        Showing {filtered.length.toLocaleString()} of {contacts.length.toLocaleString()} contacts
      </p>
    </div>
  );
}
