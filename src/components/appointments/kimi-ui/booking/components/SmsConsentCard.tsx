"use client";

import React, { useState } from "react";
import { MessageSquare, HelpCircle } from "lucide-react";
import { smsConsent } from "../mock-data";

export default function SmsConsentCard() {
  const [form, setForm] = useState(smsConsent);

  return (
    <div className="booking-card">
      <div className="booking-card-header">
        <div className="booking-card-title-row">
          <div className="booking-card-icon">
            <MessageSquare size={14} />
          </div>
          <div>
            <h3 className="booking-card-title">SMS consent &amp; legal links</h3>
            <p className="booking-card-desc">Collect consent and provide required legal information.</p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <label className="booking-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          SMS consent wording
          <HelpCircle size={13} style={{ color: "#9b99a8" }} />
        </label>
        <textarea
          className="booking-input"
          style={{ height: "auto", padding: "10px 12px", resize: "vertical", lineHeight: 1.5 }}
          rows={2}
          value={form.wording}
          onChange={(e) => setForm({ ...form, wording: e.target.value })}
        />
        <p style={{ fontSize: 11.5, color: "#9b99a8", margin: "6px 0 0" }}>
          Displayed next to the SMS opt-in checkbox on your public booking page.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div>
          <label className="booking-label">Terms of service URL</label>
          <input className="booking-input" value={form.termsUrl} onChange={(e) => setForm({ ...form, termsUrl: e.target.value })} />
        </div>
        <div>
          <label className="booking-label">Privacy policy URL</label>
          <input className="booking-input" value={form.privacyUrl} onChange={(e) => setForm({ ...form, privacyUrl: e.target.value })} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button className="booking-btn booking-btn-primary">Save consent settings</button>
      </div>
    </div>
  );
}
