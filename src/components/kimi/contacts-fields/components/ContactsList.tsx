"use client";
import { useState } from "react";
import { Users, UserCheck, UserX, Search, MoreVertical, Pencil, MessageSquare, BellOff, Trash2, Plus, SlidersHorizontal } from "lucide-react";
import { contacts, contactStats } from "../mock-data";

export default function ContactsList({ onEdit }: { onEdit: (id: string) => void }) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  return (
    <div>
      <div className="tv-page-head">
        <div className="tv-head-icon"><Users size={18} /></div>
        <div>
          <h1 className="tv-title">Contacts</h1>
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>View and manage all of your contacts.</p>
        </div>
      </div>
      <div className="tv-stats">
        <div className="tv-stat">
          <div className="tv-stat-icon" style={{ background: "var(--tv-purple-soft)", color: "var(--tv-purple)" }}><Users size={17} /></div>
          <div><div className="tv-stat-label">Contacts</div><div className="tv-stat-num">{contactStats.total}</div></div>
        </div>
        <div className="tv-stat">
          <div className="tv-stat-icon" style={{ background: "var(--tv-green-bg)", color: "var(--tv-green)" }}><UserCheck size={17} /></div>
          <div><div className="tv-stat-label">Subscribed Contacts</div><div className="tv-stat-num">{contactStats.subscribed}</div></div>
        </div>
        <div className="tv-stat">
          <div className="tv-stat-icon" style={{ background: "var(--tv-red-bg)", color: "var(--tv-red)" }}><UserX size={17} /></div>
          <div><div className="tv-stat-label">Unsubscribed Contacts</div><div className="tv-stat-num">{contactStats.unsubscribed}</div></div>
        </div>
      </div>
      <div className="tv-toolbar" style={{ justifyContent: "space-between" }}>
        <button className="tv-btn tv-btn-ghost"><SlidersHorizontal size={14} />Filter</button>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="tv-search">
            <Search size={14} className="tv-search-icon" />
            <input className="tv-input" placeholder="Search" />
          </div>
          <button className="tv-btn tv-btn-primary"><Plus size={15} />Create Contact</button>
        </div>
      </div>
      <table className="tv-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}><input type="checkbox" /></th>
            <th>First Name</th><th>Last Name</th><th>Mobile Number</th><th>Opt-In Status</th><th>Created</th><th style={{ width: 48 }} />
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className={menuFor === c.id ? "tv-row-active" : ""}>
              <td><input type="checkbox" /></td>
              <td className="tv-cell-strong">{c.firstName}</td>
              <td>{c.lastName}</td>
              <td>{c.mobile}</td>
              <td><span className={`tv-pill ${c.optIn === "Subscribed" ? "tv-pill-green" : "tv-pill-red"}`}>{c.optIn}</span></td>
              <td style={{ color: "var(--tv-muted)" }}>{c.created}</td>
              <td style={{ position: "relative", textAlign: "right" }}>
                <button className="tv-icon-btn" onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}><MoreVertical size={15} /></button>
                {menuFor === c.id && (
                  <div className="tv-dropdown" style={{ right: 0, top: 36, textAlign: "left" }}>
                    <button onClick={() => { setMenuFor(null); onEdit(c.id); }}><Pencil size={13} /> Edit</button>
                    <button><MessageSquare size={13} /> Chat</button>
                    <button><BellOff size={13} /> Unsubscribe</button>
                    <div className="tv-dd-sep" />
                    <button className="tv-dd-danger"><Trash2 size={13} /> Unsubscribe &amp; Delete</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
