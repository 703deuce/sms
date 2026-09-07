"use client";

import { Globe } from "lucide-react";

export default function BookingEnabledCard({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">
            <Globe size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
            Online booking
          </h2>
          <p className="card-sub">
            Master switch for your public booking page. When disabled, customers cannot book online.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={enabled ? "chip chip-success" : "chip"}>
            {enabled ? "Enabled" : "Disabled"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Enable online booking"
            className="settings-switch"
            data-on={enabled}
            onClick={() => onToggle(!enabled)}
          />
        </div>
      </div>
      {!enabled ? (
        <p className="card-footnote">
          Your booking page is offline. Existing appointments and reminders are unaffected.
        </p>
      ) : null}
    </section>
  );
}
