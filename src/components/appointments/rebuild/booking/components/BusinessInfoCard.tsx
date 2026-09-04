"use client";

import { Building2, ChevronDown, Check } from "lucide-react";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export default function BusinessInfoCard({
  businessDisplayName,
  timezone,
  businessPhone,
  businessAddress,
  saving,
  saved,
  onChange,
  onSave,
}: {
  businessDisplayName: string;
  timezone: string;
  businessPhone: string;
  businessAddress: string;
  saving: boolean;
  saved: boolean;
  onChange: (patch: {
    businessDisplayName?: string;
    timezone?: string;
    businessPhone?: string;
    businessAddress?: string;
  }) => void;
  onSave: () => void;
}) {
  return (
    <div className="booking-card">
      <div className="flex items-start gap-3">
        <div className="card-icon">
          <Building2 className="h-4 w-4" strokeWidth={1.9} />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Business information</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            This information appears on your public booking page.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="display-name">
            Display name
          </label>
          <input
            id="display-name"
            className="field-input"
            value={businessDisplayName}
            onChange={(e) => onChange({ businessDisplayName: e.target.value })}
            placeholder="Your business name"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="timezone">
            Timezone
          </label>
          <div className="relative">
            <select
              id="timezone"
              className="field-input appearance-none pr-9 cursor-pointer"
              value={timezone}
              onChange={(e) => onChange({ timezone: e.target.value })}
            >
              {TIMEZONES.includes(timezone) ? null : <option value={timezone}>{timezone}</option>}
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.9}
            />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="phone">
            Business phone
          </label>
          <input
            id="phone"
            className="field-input"
            value={businessPhone}
            onChange={(e) => onChange({ businessPhone: e.target.value })}
            placeholder="(555) 123-4567"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="address">
            Address
          </label>
          <input
            id="address"
            className="field-input"
            value={businessAddress}
            onChange={(e) => onChange({ businessAddress: e.target.value })}
            placeholder="123 Main St, City, ST"
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-600">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        ) : null}
        <button className="btn-primary" type="button" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save business info"}
        </button>
      </div>
    </div>
  );
}
