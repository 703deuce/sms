"use client";
import { useMemo, useState } from "react";
import { Users, UserCheck, UserX, Search, MoreVertical, Pencil, MessageSquare, BellOff, Trash2, Plus, SlidersHorizontal } from "lucide-react";
import { contacts as mockContacts, contactStats as mockStats, Contact } from "../mock-data";

export type ContactStats = { total: number; subscribed: number; unsubscribed: number };

export default function ContactsList({
  onEdit,
  onCreateContact,
  onMessage,
  onUnsubscribe,
  onDeleteContact,
  contacts: contactsProp,
  stats: statsProp,
}: {
  onEdit: (id: string) => void;
  onCreateContact?: () => void;
  onMessage?: (id: string) => void;
  onUnsubscribe?: (id: string) => void;
  onDeleteContact?: (id: string) => void;
  contacts?: Contact[];
  stats?: ContactStats;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Subscribed" | "Unsubscribed">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const rows = contactsProp ?? mockContacts;
  const stats = statsProp ?? mockStats;

  const visible = useMemo(
    () =>
      rows.filter((c) => {
        if (statusFilter !== "all" && c.optIn !== statusFilter) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return `${c.firstName} ${c.lastName} ${c.mobile} ${c.email || ""}`.toLowerCase().includes(q);
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
        <button className="tv-btn tv-btn-ghost" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
          <SlidersHorizontal size={14} />Filter{statusFilter !== "all" ? " (1)" : ""}
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="tv-search">
            <Search size={14} className="tv-search-icon" />
            <input className="tv-input" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search contacts" />
          </div>
          <button className="tv-btn tv-btn-primary" onClick={() => onCreateContact?.()}>
            <Plus size={15} />Create Contact
          </button>
        </div>
      </div>
      {filtersOpen && (
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, borderRadius: 9, border: "1px solid var(--tv-border)", background: "var(--tv-surface)", padding: "10px 14px" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tv-muted)" }}>Opt-In Status</span>
          <select
            className="tv-select tv-select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            aria-label="Filter by opt-in status"
          >
            <option value="all">All statuses</option>
            <option value="Subscribed">Subscribed</option>
            <option value="Unsubscribed">Unsubscribed</option>
          </select>
        </div>
      )}
      <div className="tv-table-card">
        <table className="tv-table">
          <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Contacts</caption>
          <thead>
            <tr>
              <th scope="col">First Name</th><th scope="col">Last Name</th><th scope="col">Mobile Number</th><th scope="col">Opt-In Status</th><th scope="col">Created</th>
              <th scope="col" style={{ width: 52 }}><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id} className={menuFor === c.id ? "tv-row-active" : ""}>
                <td className="tv-cell-strong">
                  <button className="tv-link" style={{ fontWeight: 600 }} onClick={() => onEdit(c.id)}>{c.firstName}</button>
                </td>
                <td>{c.lastName}</td>
                <td className="tv-cell-mono">{c.mobile}</td>
                <td><span className={`tv-pill ${c.optIn === "Subscribed" ? "tv-pill-green" : "tv-pill-red"}`}>{c.optIn}</span></td>
                <td style={{ color: "var(--tv-muted)", fontSize: 12.5 }}>{c.created}</td>
                <td style={{ position: "relative", textAlign: "right" }}>
                  <button className="tv-icon-btn" aria-label={`More actions for ${c.firstName} ${c.lastName}`} aria-expanded={menuFor === c.id} aria-haspopup="menu" onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}><MoreVertical size={15} /></button>
                  {menuFor === c.id && (
                    <div className="tv-dropdown" style={{ right: 0, top: 36, textAlign: "left" }} role="menu">
                      <button role="menuitem" onClick={() => { setMenuFor(null); onEdit(c.id); }}><Pencil size={13} /> Edit</button>
                      <button role="menuitem" onClick={() => { setMenuFor(null); onMessage?.(c.id); }}><MessageSquare size={13} /> Message</button>
                      {c.optIn === "Subscribed" && (
                        <button role="menuitem" onClick={() => { setMenuFor(null); onUnsubscribe?.(c.id); }}><BellOff size={13} /> Unsubscribe</button>
                      )}
                      <button role="menuitem" className="tv-danger" onClick={() => { setMenuFor(null); onDeleteContact?.(c.id); }}><Trash2 size={13} /> Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="tv-empty">
                    <div className="tv-empty-icon"><Users size={18} /></div>
                    <div className="tv-empty-title">No contacts found</div>
                    <div className="tv-empty-sub">No contacts match your current search or filters.</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="tv-table-footer">
          <span>{visible.length} contact{visible.length === 1 ? "" : "s"}</span>
          <select className="tv-select tv-select-sm" aria-label="Rows per page"><option>25 Per Page</option><option>50 Per Page</option></select>
        </div>
      </div>
    </div>
  );
}
