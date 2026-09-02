"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Users, UserCheck, UserX, Search, MoreVertical, Pencil, MessageSquare, BellOff, Trash2, Plus, SlidersHorizontal } from "lucide-react";
import { contacts, contactStats } from "../mock-data";

export type ContactStats = { total: number; subscribed: number; unsubscribed: number };

export default function ContactsList({
  onEdit,
  onCreateContact,
  onUnsubscribe,
  onDeleteContact,
  contacts: contactsProp,
  stats: statsProp,
}: {
  onEdit: (id: string) => void;
  onCreateContact?: () => void;
  onUnsubscribe?: (id: string) => void | Promise<void>;
  onDeleteContact?: (id: string) => void | Promise<void>;
  contacts?: typeof contacts;
  stats?: ContactStats;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Subscribed" | "Unsubscribed">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const rows = contactsProp ?? contacts;
  const stats = statsProp ?? contactStats;

  const visible = useMemo(
    () =>
      rows.filter((c) => {
        if (statusFilter !== "all" && c.optIn !== statusFilter) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return `${c.firstName} ${c.lastName} ${c.mobile}`.toLowerCase().includes(q);
      }),
    [rows, search, statusFilter],
  );

  return (
    <div>
      <div className="tv-page-head">
        <div className="tv-head-icon"><Users size={17} /></div>
        <div>
          <h1 className="tv-title">Contacts</h1>
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>View and manage all of your contacts.</p>
        </div>
      </div>
      <div className="tv-stats">
        <div className="tv-stat">
          <div className="tv-stat-icon" style={{ background: "var(--tv-purple-soft)", color: "var(--tv-purple)" }}><Users size={17} /></div>
          <div><div className="tv-stat-label">Contacts</div><div className="tv-stat-num">{stats.total}</div></div>
        </div>
        <div className="tv-stat">
          <div className="tv-stat-icon" style={{ background: "var(--tv-green-bg)", color: "var(--tv-green)" }}><UserCheck size={17} /></div>
          <div><div className="tv-stat-label">Subscribed Contacts</div><div className="tv-stat-num">{stats.subscribed}</div></div>
        </div>
        <div className="tv-stat">
          <div className="tv-stat-icon" style={{ background: "var(--tv-red-bg)", color: "var(--tv-red)" }}><UserX size={17} /></div>
          <div><div className="tv-stat-label">Unsubscribed Contacts</div><div className="tv-stat-num">{stats.unsubscribed}</div></div>
        </div>
      </div>
      <div className="tv-toolbar" style={{ justifyContent: "space-between" }}>
        <button className="tv-btn tv-btn-ghost" onClick={() => setFiltersOpen((v) => !v)}>
          <SlidersHorizontal size={14} />Filter{statusFilter !== "all" ? " (1)" : ""}
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="tv-search">
            <Search size={14} className="tv-search-icon" />
            <input
              className="tv-input"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="tv-btn tv-btn-primary" onClick={() => onCreateContact?.()}>
            <Plus size={15} />Create Contact
          </button>
        </div>
      </div>
      {filtersOpen && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#eceef5] bg-white px-4 py-3">
          <span className="text-[12px] font-semibold text-[#7a85a8]">Opt-In Status</span>
          <select
            className="tv-select tv-select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="Subscribed">Subscribed</option>
            <option value="Unsubscribed">Unsubscribed</option>
          </select>
        </div>
      )}
      <div className="tv-table-card">
        <table className="tv-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}><input type="checkbox" className="tv-check" disabled /></th>
              <th>First Name</th><th>Last Name</th><th>Mobile Number</th><th>Opt-In Status</th><th>Created</th><th style={{ width: 52 }} />
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id} className={menuFor === c.id ? "tv-row-active" : ""}>
                <td><input type="checkbox" className="tv-check" disabled /></td>
                <td className="tv-cell-strong">
                  <Link href={`/contacts/${c.id}`} className="text-[#3b4ef5] hover:underline">
                    {c.firstName}
                  </Link>
                </td>
                <td>{c.lastName}</td>
                <td className="tv-cell-mono">{c.mobile}</td>
                <td><span className={`tv-pill ${c.optIn === "Subscribed" ? "tv-pill-green" : "tv-pill-red"}`}>{c.optIn}</span></td>
                <td style={{ color: "var(--tv-muted)", fontSize: 12.5 }}>{c.created}</td>
                <td style={{ position: "relative", textAlign: "right" }}>
                  <button className="tv-icon-btn" onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}><MoreVertical size={15} /></button>
                  {menuFor === c.id && (
                    <div className="tv-dropdown" style={{ right: 0, top: 36, textAlign: "left" }}>
                      <button onClick={() => { setMenuFor(null); onEdit(c.id); }}><Pencil size={13} /> Edit</button>
                      <button onClick={() => { setMenuFor(null); window.location.assign("/conversations"); }}>
                        <MessageSquare size={13} /> Chat
                      </button>
                      <button
                        onClick={() => {
                          setMenuFor(null);
                          void onUnsubscribe?.(c.id);
                        }}
                      >
                        <BellOff size={13} /> Unsubscribe
                      </button>
                      <div className="tv-dd-sep" />
                      <button
                        className="tv-dd-danger"
                        onClick={() => {
                          setMenuFor(null);
                          void onDeleteContact?.(c.id);
                        }}
                      >
                        <Trash2 size={13} /> Unsubscribe &amp; Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="tv-table-footer">
          <span>{visible.length} of {stats.total} contacts</span>
          <select className="tv-select tv-select-sm"><option>25 Per Page</option><option>50 Per Page</option></select>
        </div>
      </div>
    </div>
  );
}
