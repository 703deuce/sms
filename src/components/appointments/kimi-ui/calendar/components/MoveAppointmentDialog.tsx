"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  title: string;
  customerName: string;
  fromLabel: string;
  toLabel: string;
  staffName?: string | null;
  locationName?: string | null;
  isRecurring?: boolean;
  onClose: () => void;
  onConfirm: (scope?: "this_only" | "this_and_future" | "entire_series") => void;
  error?: string | null;
  loading?: boolean;
};

export default function MoveAppointmentDialog({
  open,
  title,
  customerName,
  fromLabel,
  toLabel,
  staffName,
  locationName,
  isRecurring,
  onClose,
  onConfirm,
  error,
  loading,
}: Props) {
  const [scope, setScope] = useState<"this_only" | "this_and_future" | "entire_series">("this_only");
  if (!open) return null;

  return (
    <div className="cal-move-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cal-move-dialog"
        role="dialog"
        aria-labelledby="move-appt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="move-appt-title">Move appointment?</h2>
        <p className="cal-move-primary">{title}</p>
        <p className="cal-move-secondary">{customerName}</p>
        <dl className="cal-move-meta">
          <div>
            <dt>From</dt>
            <dd>{fromLabel}</dd>
          </div>
          <div>
            <dt>To</dt>
            <dd>{toLabel}</dd>
          </div>
          {staffName ? (
            <div>
              <dt>Staff</dt>
              <dd>{staffName}</dd>
            </div>
          ) : null}
          {locationName ? (
            <div>
              <dt>Location</dt>
              <dd>{locationName}</dd>
            </div>
          ) : null}
        </dl>

        {isRecurring ? (
          <fieldset className="cal-move-scope">
            <legend>Apply this change to</legend>
            <label>
              <input
                type="radio"
                name="recurring-scope"
                checked={scope === "this_only"}
                onChange={() => setScope("this_only")}
              />
              This appointment only
            </label>
            <label>
              <input
                type="radio"
                name="recurring-scope"
                checked={scope === "this_and_future"}
                onChange={() => setScope("this_and_future")}
              />
              This and future appointments
            </label>
            <label>
              <input
                type="radio"
                name="recurring-scope"
                checked={scope === "entire_series"}
                onChange={() => setScope("entire_series")}
              />
              Entire series
            </label>
          </fieldset>
        ) : null}

        {error ? <p className="cal-move-error" role="alert">{error}</p> : null}

        <div className="cal-move-actions">
          <button type="button" className="btn-today" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onConfirm(isRecurring ? scope : undefined)}
            disabled={loading}
          >
            {loading ? "Moving…" : "Move appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}
