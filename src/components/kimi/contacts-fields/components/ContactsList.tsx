"use client";
import { useState } from "react";
import { Users, UserCheck, UserX, Search, MoreVertical, Pencil, MessageSquare, BellOff, Trash2 } from "lucide-react";
import { contacts, contactStats } from "../mock-data";

export default function ContactsList({ onEdit }: { onEdit: (id: string) => void }) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  return (
    <div>
      <div className="tv-page-head">
        <div className="tv-head-icon"><Users size={19} /></div>
        <div>
          <h1 className="tv-title">Contacts</h1>
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>View and manage all of your contacts.</p>
        </div>
      </div>
      <div className="tv-stats">
        <div className="tv-stat">
          <div className="tv-stat-icon" style={{ background: "#eef0fe", color: "var(--tv-purple)" }}><Users size={17} /></div>
          <div><div className="tv-stat-label">Contacts</div><div className="tv-stat-num">{contactStats.total}</div></div>
        </div>
        <div className="tv-stat">
          <div className="tv-stat-icon" style={{ background: "#e5f7ee", color: "#16a34a" }}><UserCheck size={17} /></div>
          <div><div className="tv-stat-label">Subscribed Contacts</div><div className="tv-stat-num">{contactStats.subscribed}</div></div>
        </div>
        <div className="tv-stat">
          <div className="tv-stat-icon" style={{ background: "#fdeaea", color: "#dc2626" }}><UserX size={17} /></div>
          <div><div className="tv-stat-label">Unsubscribed Contacts</div><div className="tv-stat-num">{contactStats.unsubscribed}</div></div>
        </div>
      </div>
      <div className="tv-toolbar" style={{ justifyContent: "space-between" }}>
        <button className="tv-btn tv-btn-ghost">▽ Filter</button>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <input className="tv-input" placeholder="Search" style={{ paddingRight: 34 }} />
            <Search size={15} style={{ position: "absolute", right: 11, top: 10, color: "#9aa0b4" }} />
          </div>
          <button className="tv-btn tv-btn-primary">Create Contact</button>
        </div>
      </div>
      <table className="tv-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}><input type="checkbox" /></th>
            <th>First Name</th><th>Last Name</th><th>Mobile Number</th><th>Opt-In Status</th><th>Created</th><th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className={menuFor === c.id ? "tv-row-active" : ""}>
              <td><input type="checkbox" /></td>
              <td>{c.firstName}</td>
              <td>{c.lastName}</td>
              <td>{c.mobile}</td>
              <td><span className="tv-pill tv-pill-green">{c.optIn}</span></td>
              <td>{c.created}</td>
              <td style={{ position: "relative" }}>
                <button className="tv-icon-btn" onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}><MoreVertical size={15} /></button>
                {menuFor === c.id && (
                  <div className="tv-dropdown" style={{ right: 0, top: 34 }}>
                    <button onClick={() => { setMenuFor(null); onEdit(c.id); }}><Pencil size={13} /> Edit</button>
                    <button><MessageSquare size={13} /> Chat</button>
                    <button><BellOff size={13} /> Unsubscribe</button>
                    <button style={{ color: "#dc2626" }}><Trash2 size={13} /> Unsubscribe &amp; Delete</button>
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
