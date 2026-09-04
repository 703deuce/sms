"use client";

import React, { useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { businessInfo } from "../mock-data";

export default function BusinessInfoCard() {
  const [form, setForm] = useState(businessInfo);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="booking-card">
      <div className="booking-card-header">
        <div className="booking-card-title-row">
          <div className="booking-card-icon">
            <Building2 size={14} />
          </div>
          <div>
            <h3 className="booking-card-title">Business information</h3>
            <p className="booking-card-desc">This information appears on your public booking page.</p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 18 }}>
        <div>
          <label className="booking-label">Display name</label>
          <input className="booking-input" value={form.displayName} onChange={set("displayName")} />
        </div>
        <div>
          <label className="booking-label">Timezone</label>
          <div style={{ position: "relative" }}>
            <input className="booking-input" value={form.timezone} readOnly style={{ cursor: "pointer", paddingRight: 32 }} />
            <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#8a8798", pointerEvents: "none" }} />
          </div>
        </div>
        <div>
          <label className="booking-label">Business phone</label>
          <input className="booking-input" value={form.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className="booking-label">Address</label>
          <input className="booking-input" value={form.address} onChange={set("address")} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button className="booking-btn booking-btn-primary">Save business info</button>
      </div>
    </div>
  );
}
