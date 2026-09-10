"use client";

import { useEffect, useState } from "react";

const PRESETS = [
  { id: "inactive_60_days", label: "Inactive 60+ days", description: "Customers without a recent appointment" },
  { id: "membership_customers", label: "Active members", description: "Customers with an active membership" },
  { id: "low_credits", label: "Low package credits", description: "Customers running low on package credits" },
  { id: "booked_tomorrow", label: "Booked tomorrow", description: "Customers with an appointment tomorrow" },
] as const;

type SegmentContact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
};

export function RecallSavedViews() {
  const [activePreset, setActivePreset] = useState<string>("inactive_60_days");
  const [contacts, setContacts] = useState<SegmentContact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/appointments/service-booking/appointment-segments?preset=${activePreset}`)
      .then((r) => r.json())
      .then((j) => setContacts(j.data || []))
      .finally(() => setLoading(false));
  }, [activePreset]);

  return (
    <section className="tv-card" style={{ marginTop: 16 }}>
      <div className="tv-section-head">
        <h2 className="tv-section-title" style={{ margin: 0 }}>Recall groups</h2>
        <a className="tv-btn" href="/automations/recall">Manage recall automation</a>
      </div>
      <p className="tv-subtitle">
        Saved recall views help you focus on customers who are due to return. General customer segments remain under Contacts.
      </p>
      <div className="tv-filter-chips" role="group" aria-label="Recall groups">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`tv-chip ${activePreset === preset.id ? "tv-chip--active" : ""}`}
            onClick={() => setActivePreset(preset.id)}
            aria-pressed={activePreset === preset.id}
          >
            {preset.label}
            <span className="tv-chip-count">{activePreset === preset.id && !loading ? contacts.length : "…"}</span>
          </button>
        ))}
      </div>
      {loading ? (
        <p className="tv-subtitle">Loading recall group…</p>
      ) : contacts.length ? (
        <table className="tv-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Contact</th>
              <th scope="col" style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.slice(0, 25).map((c) => {
              const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Customer";
              return (
                <tr key={c.id}>
                  <td>{name}</td>
                  <td>{c.phone || c.email || "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <a className="tv-btn tv-btn--sm" href={`/appointments/new?contactId=${c.id}`}>Book</a>
                    <a className="tv-btn tv-btn--sm" href={`/conversations?contact=${c.id}`}>Message</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="tv-subtitle" style={{ marginTop: 12 }}>No customers match this recall group right now.</p>
      )}
    </section>
  );
}
