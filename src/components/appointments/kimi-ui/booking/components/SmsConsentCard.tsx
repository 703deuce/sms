"use client";

import React from "react";
import { MessageSquare, HelpCircle, Check } from "lucide-react";
import type { BookingPageModel } from "@/features/appointments/kimi/booking/types";

type Props = {
  smsConsent: BookingPageModel["smsConsent"];
  saving?: boolean;
  saved?: boolean;
  onFieldChange: (field: keyof BookingPageModel["smsConsent"], value: string) => void;
  onSave: () => void;
};

export default function SmsConsentCard({
  smsConsent,
  saving = false,
  saved = false,
  onFieldChange,
  onSave,
}: Props) {
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
          value={smsConsent.wording}
          onChange={(e) => onFieldChange("wording", e.target.value)}
        />
        <p style={{ fontSize: 11.5, color: "#9b99a8", margin: "6px 0 0" }}>
          Displayed next to the SMS opt-in checkbox on your public booking page.
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <label className="booking-label">Terms &amp; conditions text</label>
        <textarea
          className="booking-input"
          style={{ height: "auto", padding: "10px 12px", resize: "vertical", lineHeight: 1.5 }}
          rows={4}
          value={smsConsent.termsText}
          onChange={(e) => onFieldChange("termsText", e.target.value)}
          placeholder="Enter the terms customers must accept when booking..."
        />
        <p style={{ fontSize: 11.5, color: "#9b99a8", margin: "6px 0 0" }}>
          Current version: <strong>{smsConsent.termsVersion || "v1"}</strong>. Saving changed text bumps the version
          so prior acceptances stay tied to the old terms.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div>
          <label className="booking-label">Terms of service URL</label>
          <input
            className="booking-input"
            value={smsConsent.termsUrl}
            onChange={(e) => onFieldChange("termsUrl", e.target.value)}
          />
        </div>
        <div>
          <label className="booking-label">Privacy policy URL</label>
          <input
            className="booking-input"
            value={smsConsent.privacyUrl}
            onChange={(e) => onFieldChange("privacyUrl", e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 16 }}>
        {saved ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "#12834a" }}>
            <Check size={14} /> Saved
          </span>
        ) : null}
        <button
          type="button"
          className="booking-btn booking-btn-primary"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save consent settings"}
        </button>
      </div>
    </div>
  );
}
