"use client";

import React from "react";
import { Calendar, Globe, ExternalLink, Copy, Mail, Share2, MoreHorizontal, BellRing } from "lucide-react";
import type { BookingPageModel } from "@/features/appointments/kimi/booking/types";

type Props = {
  model: BookingPageModel;
  copied?: boolean;
  saving?: boolean;
  onToggle: (enabled: boolean) => void;
  onCopy: () => void;
  onOpen: () => void;
};

export default function PublicBookingCard({
  model,
  copied = false,
  saving = false,
  onToggle,
  onCopy,
  onOpen,
}: Props) {
  const { bookingEnabled, bookingUrl, hasSlug } = model;

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
              {bookingEnabled
                ? "Your booking page is live. Customers can book using your public link."
                : "Allow customers to book appointments through your public booking page."}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className="enabled-label">{bookingEnabled ? "Enabled" : "Disabled"}</span>
          <button
            type="button"
            className={`booking-toggle${bookingEnabled ? "" : " off"}`}
            onClick={() => onToggle(!bookingEnabled)}
            disabled={saving || !hasSlug}
            aria-label="Toggle booking page"
          >
            <span className="booking-toggle-knob" />
          </button>
        </div>
      </div>

      {hasSlug ? (
        <div style={{ marginTop: 18 }}>
          <label className="booking-label">Public booking URL</label>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Globe
                size={14}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8a8798" }}
              />
              <input
                className="booking-input readonly"
                style={{ paddingLeft: 34 }}
                value={bookingUrl}
                readOnly
              />
            </div>
            <button type="button" className="booking-btn" onClick={onOpen}>
              <ExternalLink size={14} /> Open
            </button>
            <button type="button" className="booking-btn" onClick={onCopy}>
              <Copy size={14} /> {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      ) : (
        <p className="booking-card-desc" style={{ marginTop: 18, color: "#b45309" }}>
          Set a workspace slug in Settings before sharing a booking link.
        </p>
      )}

      {hasSlug ? (
        <div style={{ marginTop: 18 }}>
          <label className="booking-label" style={{ marginBottom: 2 }}>Share your booking page</label>
          <p className="booking-card-desc" style={{ marginBottom: 10 }}>Promote your booking page across channels.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="booking-btn" onClick={onCopy}>
              <Copy size={14} /> {copied ? "Copied" : "Copy link"}
            </button>
            <a
              href={`/book/${model.workspaceSlug}/reminders`}
              className="booking-btn"
              style={{ textDecoration: "none" }}
            >
              <BellRing size={14} /> Preview reminder schedule
            </a>
            <button type="button" className="booking-btn"><Mail size={14} /> Email</button>
            <button type="button" className="booking-btn"><Share2 size={14} /> Facebook</button>
            <button type="button" className="booking-btn"><Share2 size={14} /> X (Twitter)</button>
            <button type="button" className="booking-btn"><MoreHorizontal size={14} /> More</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
