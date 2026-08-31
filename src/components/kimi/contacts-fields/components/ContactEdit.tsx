"use client";
import { Users, Lightbulb, X } from "lucide-react";
import { contacts, CustomField } from "../mock-data";

export default function ContactEdit({ contactId, fields }: { contactId: string; fields: CustomField[] }) {
  const c = contacts.find((x) => x.id === contactId) ?? contacts[0];
  return (
    <div>
      <div className="tv-breadcrumb">Contacts / {c.firstName} {c.lastName}</div>
      <div className="tv-page-head">
        <div className="tv-head-icon"><Users size={19} /></div>
        <div>
          <h1 className="tv-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {c.firstName} {c.lastName} <span className="tv-pill tv-pill-green">{c.optIn}</span>
          </h1>
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>Created on {c.created} CDT via Manual Creation.</p>
        </div>
      </div>
      <div className="tv-two-col" style={{ marginTop: 20 }}>
        <div style={{ flex: 1, maxWidth: 520 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label className="tv-label" style={{ marginTop: 0 }}>First Name</label><input className="tv-input" style={{ width: "100%", minWidth: 0 }} defaultValue={c.firstName} /></div>
            <div style={{ flex: 1 }}><label className="tv-label" style={{ marginTop: 0 }}>Last Name</label><input className="tv-input" style={{ width: "100%", minWidth: 0 }} defaultValue={c.lastName} /></div>
          </div>
          <label className="tv-label">Mobile Number</label>
          <input className="tv-input" style={{ width: "100%", minWidth: 0 }} defaultValue={c.mobile} />
          <label className="tv-label">Email</label>
          <input className="tv-input" style={{ width: "100%", minWidth: 0 }} defaultValue={c.email} />
          <label className="tv-label">Birthdate</label>
          <input className="tv-input" style={{ width: "100%", minWidth: 0 }} placeholder="mm/dd/yyyy" type="date" />
          <label className="tv-label">Address</label>
          <input className="tv-input" style={{ width: "100%", minWidth: 0 }} placeholder="Enter a location" />
          <label className="tv-label">City</label>
          <input className="tv-input" style={{ width: "100%", minWidth: 0 }} />
          <label className="tv-label">State / Province</label>
          <select className="tv-select" style={{ width: "100%" }}><option>None</option></select>
          <label className="tv-label">Postal Code</label>
          <input className="tv-input" style={{ width: "100%", minWidth: 0 }} />
          <label className="tv-label">Country</label>
          <select className="tv-select" style={{ width: "100%" }}><option>None</option></select>

          <h3 className="tv-section-title">Custom Fields</h3>
          <p className="tv-section-sub">
            Custom fields allow you to store custom data on your contacts. You can manage your custom fields{" "}
            <span style={{ color: "var(--tv-purple)", cursor: "pointer" }}>here</span>.
          </p>
          {fields.map((f) => (
            <div key={f.id}>
              <label className="tv-label">{f.name}</label>
              {f.type === "Yes / No" ? (
                <select className="tv-select" style={{ width: "100%" }}><option>None</option><option>Yes</option><option>No</option></select>
              ) : f.type === "Date" ? (
                <input type="date" className="tv-input" style={{ width: "100%", minWidth: 0 }} />
              ) : (
                <input className="tv-input" style={{ width: "100%", minWidth: 0 }} type={f.type === "Number" ? "number" : "text"} />
              )}
            </div>
          ))}

          <h3 className="tv-section-title">Lists</h3>
          <p className="tv-section-sub">Select one or more optional lists for this contact to be on. You can manage your contact lists here.</p>
          <div style={{ border: "1px solid var(--tv-border)", borderRadius: 8, padding: 10, background: "#fff" }}>
            {c.lists.map((l) => (
              <span key={l} className="tv-tag">{l} <X size={12} style={{ cursor: "pointer" }} /></span>
            ))}
            <input placeholder="Search" style={{ border: "none", outline: "none", fontSize: 13, padding: 4 }} />
          </div>

          <h3 className="tv-section-title">Opt-In Status</h3>
          <select className="tv-select" style={{ width: "100%" }}><option>Subscribed</option><option>Unsubscribed</option></select>

          <div className="tv-form-actions">
            <button className="tv-btn tv-btn-primary" style={{ minWidth: 110 }}>Save</button>
          </div>
        </div>
        <div className="tv-tip-card">
          <div style={{ display: "flex", gap: 12 }}>
            <div className="tv-stat-icon" style={{ background: "#eef0fe", color: "var(--tv-purple)", flexShrink: 0 }}><Lightbulb size={17} /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--tv-navy)" }}>Need to update multiple contacts?</div>
              <p style={{ fontSize: 12.5, color: "var(--tv-muted)", margin: "6px 0 10px" }}>You can easily upload a list using our import tool.</p>
              <button className="tv-link" style={{ fontWeight: 600 }}>Import a List</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
