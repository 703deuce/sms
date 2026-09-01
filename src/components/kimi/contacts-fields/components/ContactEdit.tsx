"use client";
import { useRef } from "react";
import { Users, Lightbulb, X } from "lucide-react";
import { contacts, CustomField, type Contact } from "../mock-data";

type SavePayload = {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  optIn: string;
};

export default function ContactEdit({
  contactId,
  fields,
  contact: contactProp,
  onBack,
  onSave,
}: {
  contactId: string;
  fields: CustomField[];
  contact?: Contact;
  onBack?: () => void;
  onSave?: (payload: SavePayload) => Promise<void>;
}) {
  const c = contactProp ?? contacts.find((x) => x.id === contactId) ?? contacts[0];
  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const optInRef = useRef<HTMLSelectElement>(null);

  const handleSave = () => {
    if (!onSave) return;
    void onSave({
      firstName: firstRef.current?.value ?? c.firstName,
      lastName: lastRef.current?.value ?? c.lastName,
      mobile: mobileRef.current?.value ?? c.mobile,
      email: emailRef.current?.value ?? c.email,
      optIn: optInRef.current?.value ?? c.optIn,
    });
  };

  return (
    <div>
      <div className="tv-breadcrumb">Contacts <span className="tv-crumb-sep">/</span> <span className="tv-crumb-current">{c.firstName} {c.lastName}</span></div>
      <div className="tv-page-head">
        <div className="tv-head-icon"><Users size={17} /></div>
        <div>
          <h1 className="tv-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {c.firstName} {c.lastName} <span className={`tv-pill ${c.optIn === "Subscribed" ? "tv-pill-green" : "tv-pill-red"}`}>{c.optIn}</span>
          </h1>
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>Created on {c.created} CDT via Manual Creation.</p>
        </div>
      </div>
      <div className="tv-two-col" style={{ marginTop: 22 }}>
        <div className="tv-form-card" style={{ flex: 1, maxWidth: 560, marginTop: 0 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="tv-field-group" style={{ flex: 1 }}><label className="tv-label" style={{ marginTop: 0 }}>First Name</label><input ref={firstRef} className="tv-input tv-input-full" defaultValue={c.firstName} /></div>
            <div className="tv-field-group" style={{ flex: 1 }}><label className="tv-label" style={{ marginTop: 0 }}>Last Name</label><input ref={lastRef} className="tv-input tv-input-full" defaultValue={c.lastName} /></div>
          </div>
          <div className="tv-field-group"><label className="tv-label">Mobile Number</label><input ref={mobileRef} className="tv-input tv-input-full" defaultValue={c.mobile} /></div>
          <div className="tv-field-group"><label className="tv-label">Email</label><input ref={emailRef} className="tv-input tv-input-full" defaultValue={c.email} /></div>
          <div className="tv-field-group"><label className="tv-label">Birthdate</label><input className="tv-input tv-input-full" placeholder="mm/dd/yyyy" type="date" /></div>
          <div className="tv-field-group"><label className="tv-label">Address</label><input className="tv-input tv-input-full" placeholder="Enter a location" /></div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="tv-field-group" style={{ flex: 1 }}>
              <label className="tv-label">City</label>
              <input className="tv-input tv-input-full" />
            </div>
            <div className="tv-field-group" style={{ flex: 1 }}>
              <label className="tv-label">Postal Code</label>
              <input className="tv-input tv-input-full" />
            </div>
          </div>
          <div className="tv-field-group"><label className="tv-label">State / Province</label><select className="tv-select tv-select-full"><option>None</option></select></div>
          <div className="tv-field-group"><label className="tv-label">Country</label><select className="tv-select tv-select-full"><option>None</option></select></div>

          <h3 className="tv-section-title">Custom Fields</h3>
          <p className="tv-section-sub">
            Custom fields allow you to store custom data on your contacts. You can manage your custom fields{" "}
            <button className="tv-link">here</button>.
          </p>
          {fields.map((f) => (
            <div className="tv-field-group" key={f.id}>
              <label className="tv-label">{f.name}</label>
              {f.type === "Yes / No" ? (
                <select className="tv-select tv-select-full"><option>None</option><option>Yes</option><option>No</option></select>
              ) : f.type === "Date" ? (
                <input type="date" className="tv-input tv-input-full" />
              ) : (
                <input className="tv-input tv-input-full" type={f.type === "Number" ? "number" : "text"} />
              )}
            </div>
          ))}

          <h3 className="tv-section-title">Lists</h3>
          <p className="tv-section-sub">Select one or more optional lists for this contact to be on. You can manage your contact lists <button className="tv-link">here</button>.</p>
          <div className="tv-tag-box">
            {c.lists.map((l) => (
              <span key={l} className="tv-tag">{l} <X size={12} style={{ cursor: "pointer" }} /></span>
            ))}
            <input placeholder="Search" className="tv-tag-input" />
          </div>

          <h3 className="tv-section-title">Opt-In Status</h3>
          <div className="tv-field-group">
            <select ref={optInRef} className="tv-select tv-select-full" defaultValue={c.optIn}>
              <option>Subscribed</option>
              <option>Unsubscribed</option>
            </select>
          </div>

          <div className="tv-form-actions">
            <button type="button" className="tv-btn tv-btn-primary" style={{ minWidth: 110 }} onClick={handleSave}>Save</button>
            <button type="button" className="tv-btn tv-btn-ghost" style={{ minWidth: 110 }} onClick={onBack}>Back</button>
          </div>
        </div>
        <div className="tv-tip-card">
          <div style={{ display: "flex", gap: 12 }}>
            <div className="tv-stat-icon" style={{ background: "var(--tv-purple-soft)", color: "var(--tv-purple)", flexShrink: 0 }}><Lightbulb size={17} /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--tv-navy)" }}>Need to update multiple contacts?</div>
              <p style={{ fontSize: 12.5, color: "var(--tv-muted)", margin: "6px 0 10px", lineHeight: 1.5 }}>You can easily upload a list using our import tool.</p>
              <button className="tv-link" style={{ fontWeight: 600 }}>Import a List</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
