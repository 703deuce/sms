"use client";

import React from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import type { BookingPageModel } from "@/features/appointments/kimi/booking/types";

type Props = {
  businessInfo: BookingPageModel["businessInfo"];
  saving?: boolean;
  saved?: boolean;
  onFieldChange: (field: keyof BookingPageModel["businessInfo"], value: string) => void;
  onSave: () => void;
};

export default function BusinessInfoCard({
  businessInfo,
  saving = false,
  saved = false,
  onFieldChange,
  onSave,
}: Props) {
  const set = (k: keyof BookingPageModel["businessInfo"]) =>
    (e: React.ChangeEvent<HTMLInputElement>) => onFieldChange(k, e.target.value);

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
          <input className="booking-input" value={businessInfo.displayName} onChange={set("displayName")} />
        </div>
        <div>
          <label className="booking-label">Timezone</label>
          <div style={{ position: "relative" }}>
            <input
              className="booking-input"
              value={businessInfo.timezone}
              onChange={set("timezone")}
              style={{ paddingRight: 32 }}
            />
            <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#8a8798", pointerEvents: "none" }} />
          </div>
        </div>
        <div>
          <label className="booking-label">Business phone</label>
          <input className="booking-input" value={businessInfo.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className="booking-label">Address</label>
          <input className="booking-input" value={businessInfo.address} onChange={set("address")} />
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
          {saving ? "Saving…" : "Save business info"}
        </button>
      </div>
    </div>
  );
}
