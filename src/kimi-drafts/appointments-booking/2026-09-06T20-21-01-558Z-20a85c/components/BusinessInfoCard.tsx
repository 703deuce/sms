"use client";

import React from "react";
import { Building2, Check } from "lucide-react";
import { timezones } from "../mock-data";

type BusinessInfo = {
  displayName: string;
  timezone: string;
  phone: string;
  address: string;
};

type Props = {
  businessInfo: BusinessInfo;
  saving: boolean;
  saved: boolean;
  onFieldChange: (field: keyof BusinessInfo, value: string) => void;
  onSave: () => void;
};

export default function BusinessInfoCard({
  businessInfo,
  saving,
  saved,
  onFieldChange,
  onSave,
}: Props) {
  return (
    <section className="bk-card" aria-labelledby="bk-biz-title">
      <h2 id="bk-biz-title" className="bk-card-title">
        <Building2 size={15} className="text-blue-600" strokeWidth={2} />
        Business information
      </h2>
      <p className="bk-card-desc">
        Shown on your booking page and in customer confirmations.
      </p>

      <div className="bk-field">
        <label className="bk-label" htmlFor="bk-display-name">
          Display name
        </label>
        <input
          id="bk-display-name"
          className="bk-input"
          value={businessInfo.displayName}
          onChange={(e) => onFieldChange("displayName", e.target.value)}
        />
      </div>

      <div className="bk-row">
        <div className="bk-field">
          <label className="bk-label" htmlFor="bk-timezone">
            Timezone
          </label>
          <select
            id="bk-timezone"
            className="bk-select"
            value={businessInfo.timezone}
            onChange={(e) => onFieldChange("timezone", e.target.value)}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace("_", " ")}
              </option>
            ))}
          </select>
          <p className="bk-hint">
            Availability and appointment times are interpreted in this timezone.
          </p>
        </div>
        <div className="bk-field">
          <label className="bk-label" htmlFor="bk-phone">
            Phone
          </label>
          <input
            id="bk-phone"
            type="tel"
            className="bk-input"
            value={businessInfo.phone}
            onChange={(e) => onFieldChange("phone", e.target.value)}
            placeholder="(555) 555-1234"
          />
        </div>
      </div>

      <div className="bk-field">
        <label className="bk-label" htmlFor="bk-address">
          Address
        </label>
        <input
          id="bk-address"
          className="bk-input"
          value={businessInfo.address}
          onChange={(e) => onFieldChange("address", e.target.value)}
          placeholder="Street, city, state, ZIP"
        />
      </div>

      <div className="bk-card-actions">
        {saved && (
          <span className="bk-saved-note" role="status">
            <Check size={13} /> Saved
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </section>
  );
}
