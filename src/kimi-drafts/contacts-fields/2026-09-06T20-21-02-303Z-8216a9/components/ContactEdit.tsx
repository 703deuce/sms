"use client";
import { useRef, useState } from "react";
import { Users, X } from "lucide-react";
import { contacts, CustomField, listOptions as defaultListOptions, type Contact } from "../mock-data";

type SavePayload = {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  optIn: string;
  selectedLists: string[];
  customFields: Record<string, string>;
};

export default function ContactEdit({
  contactId,
  fields,
  contact: contactProp,
  listOptions = defaultListOptions,
  onBack,
  onSave,
}: {
  contactId: string;
  fields: CustomField[];
  contact?: Contact;
  listOptions?: Array<{ id: string; name: string }>;
  onBack?: () => void;
  onSave?: (payload: SavePayload) => void;
}) {
  const c = contactProp ?? contacts.find((x) => x.id === contactId) ?? contacts[0];
  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const optInRef = useRef<HTMLSelectElement>(null);
  const customFieldRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const [selectedLists, setSelectedLists] = useState<string[]>(c.lists);
  const [listQuery, setListQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);

  const availableLists = listOptions
    .map((l) => l.name)
    .filter((name) => name.toLowerCase().includes(listQuery.toLowerCase()) && !selectedLists.includes(name));

  const fieldKey = (field: CustomField) => field.mergeTag.replace(/^\{\{|\}\}$/g, "");

  const handleSave = () => {
    if (!onSave) return;
    const customFields: Record<string, string> = {};
    for (const field of fields) {
      const key = fieldKey(field);
      const el = customFieldRefs.current[key];
      if (!el) continue;
      const value = "value" in el ? el.value.trim() : "";
      if (value) customFields[key] = value;
    }
    onSave({
      firstName: firstRef.current?.value ?? c.firstName,
      lastName: lastRef.current?.value ?? c.lastName,
      mobile: mobileRef.current?.value ?? c.mobile,
      email: emailRef.current?.value ?? c.email,
      optIn: optInRef.current?.value ?? c.optIn,
      selectedLists,
      customFields,
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
          <p className="tv-subtitle" style={{ marginBottom: 0 }}>
            {c.created ? `Created ${c.created}.` : "Contact profile"}
          </p>
        </div>
      </div>
      <div className="tv-two-col" style={{ marginTop: 22 }}>
        <div className="tv-form-card" style={{ flex: 1, maxWidth: 560, marginTop: 0 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="tv-field-group" style={{ flex: 1 }}><label className="tv-label" style={{ marginTop: 0 }} htmlFor="ce-first">First Name</label><input id="ce-first" ref={firstRef} className="tv-input tv-input-full" defaultValue={c.firstName} /></div>
            <div className="tv-field-group" style={{ flex: 1 }}><label className="tv-label" style={{ marginTop: 0 }} htmlFor="ce-last">Last Name</label><input id="ce-last" ref={lastRef} className="tv-input tv-input-full" defaultValue={c.lastName} /></div>
          </div>
          <div className="tv-field-group"><label className="tv-label" htmlFor="ce-mobile">Mobile Number</label><input id="ce-mobile" ref={mobileRef} className="tv-input tv-input-full" defaultValue={c.mobile} type="tel" /></div>
          <div className="tv-field-group"><label className="tv-label" htmlFor="ce-email">Email</label><input id="ce-email" ref={emailRef} className="tv-input tv-input-full" defaultValue={c.email} type="email" placeholder="name@example.com" /></div>
          <div className="tv-field-group"><label className="tv-label" htmlFor="ce-optin">Opt-In Status</label>
            <select id="ce-optin" ref={optInRef} className="tv-select tv-select-full" defaultValue={c.optIn}>
              <option>Subscribed</option>
              <option>Unsubscribed</option>
            </select>
          </div>

          <div className="tv-field-group" style={{ position: "relative" }}>
            <label className="tv-label" htmlFor="ce-lists">Lists</label>
            <input
              id="ce-lists"
              className="tv-input tv-input-full"
              placeholder="Search lists..."
              value={listQuery}
              onChange={(e) => { setListQuery(e.target.value); setListOpen(true); }}
              onFocus={() => setListOpen(true)}
            />
            {selectedLists.length > 0 && (
              <div className="tv-chips">
                {selectedLists.map((name) => (
                  <span className="tv-chip" key={name}>
                    {name}
                    <button aria-label={`Remove ${name}`} onClick={() => setSelectedLists(selectedLists.filter((l) => l !== name))}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            {listOpen && availableLists.length > 0 && (
              <div className="tv-options" role="listbox" aria-label="Available lists">
                {availableLists.map((name) => (
                  <button key={name} role="option" aria-selected={false} onClick={() => { setSelectedLists([...selectedLists, name]); setListQuery(""); setListOpen(false); }}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <h3 className="tv-section-title">Custom Fields</h3>
          <p className="tv-section-sub">
            Custom fields store additional data on this contact. Manage custom fields from{" "}
            <button className="tv-link" onClick={onBack}>Contacts → Custom Fields</button>.
          </p>
          {fields.length === 0 && (
            <p style={{ fontSize: 12.5, color: "var(--tv-muted)", fontStyle: "italic" }}>No custom fields configured yet.</p>
          )}
          {fields.map((f) => {
            const key = fieldKey(f);
            const initialValue = c.customFields?.[key] || "";
            return (
              <div className="tv-field-group" key={f.id}>
                <label className="tv-label" htmlFor={`ce-cf-${key}`}>{f.name}</label>
                {f.type === "Yes / No" ? (
                  <select
                    id={`ce-cf-${key}`}
                    ref={(el) => { customFieldRefs.current[key] = el; }}
                    className="tv-select tv-select-full"
                    defaultValue={initialValue}
                  >
                    <option value="">Not set</option>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                ) : f.type === "Date" ? (
                  <input
                    id={`ce-cf-${key}`}
                    ref={(el) => { customFieldRefs.current[key] = el; }}
                    className="tv-input tv-input-full"
                    type="date"
                    defaultValue={initialValue}
                  />
                ) : f.type === "Number" ? (
                  <input
                    id={`ce-cf-${key}`}
                    ref={(el) => { customFieldRefs.current[key] = el; }}
                    className="tv-input tv-input-full"
                    type="number"
                    defaultValue={initialValue}
                  />
                ) : (
                  <input
                    id={`ce-cf-${key}`}
                    ref={(el) => { customFieldRefs.current[key] = el; }}
                    className="tv-input tv-input-full"
                    defaultValue={initialValue}
                    placeholder={f.description || `Enter ${f.name.toLowerCase()}`}
                  />
                )}
              </div>
            );
          })}

          <div className="tv-form-actions">
            <button className="tv-btn tv-btn-primary" style={{ minWidth: 110 }} onClick={handleSave}>Save</button>
            <button className="tv-btn tv-btn-ghost" style={{ minWidth: 110 }} onClick={onBack}>Back</button>
          </div>
        </div>
      </div>
    </div>
  );
}
