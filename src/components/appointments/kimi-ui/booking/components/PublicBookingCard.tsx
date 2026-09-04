"use client";

import React, { useState } from "react";
import { Calendar, Globe, ExternalLink, Copy, Mail, Facebook, Twitter, MoreHorizontal } from "lucide-react";
import { bookingData } from "../mock-data";

export default function PublicBookingCard() {
  const [enabled, setEnabled] = useState(bookingData.enabled);

  return (
    <div className="booking-card">
      <div className="booking-card-header">
        <div className="booking-card-title-row">
          <div className="booking-card-icon">
            <Calendar size={14} />
          </div>
          <div>
            <h3 className="booking-card-title">Public booking page</h3>
            <p className="booking-card-desc">
              Allow customers to book appointments through your public booking page.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className="enabled-label">Enabled</span>
          <button
            className={`booking-toggle${enabled ? "" : " off"}`}
            onClick={() => setEnabled(!enabled)}
            aria-label="Toggle booking page"
          >
            <span className="booking-toggle-knob" />
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <label className="booking-label">Public booking URL</label>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Globe
              size={14}
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8a8798" }}
            />
            <input className="booking-input readonly" style={{ paddingLeft: 34 }} value={bookingData.publicUrl} readOnly />
          </div>
          <button className="booking-btn">
            <ExternalLink size={14} /> Open
          </button>
          <button className="booking-btn">
            <Copy size={14} /> Copy link
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <label className="booking-label" style={{ marginBottom: 2 }}>Share your booking page</label>
        <p className="booking-card-desc" style={{ marginBottom: 10 }}>Promote your booking page across channels.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="booking-btn"><Copy size={14} /> Copy link</button>
          <button className="booking-btn"><Mail size={14} /> Email</button>
          <button className="booking-btn"><Facebook size={14} /> Facebook</button>
          <button className="booking-btn"><Twitter size={14} /> X (Twitter)</button>
          <button className="booking-btn"><MoreHorizontal size={14} /> More</button>
        </div>
      </div>
    </div>
  );
}
