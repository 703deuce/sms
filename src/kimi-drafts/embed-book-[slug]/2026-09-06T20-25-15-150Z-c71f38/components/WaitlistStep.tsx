"use client";

import { useState } from "react";
import { ArrowLeft, BellRing } from "lucide-react";
import type { BookingType } from "../mock-data";
import type { BookingState } from "../page";

export default function WaitlistStep({
  type,
  state,
  update,
  onBack,
  onJoined,
}: {
  type: BookingType;
  state: BookingState;
  update: (patch: Partial<BookingState>) => void;
  onBack: () => void;
  onJoined: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const invalid = !state.firstName.trim() || !state.phone.trim();

  function join() {
    setSubmitting(true);
    // Sandbox: simulate /api/public/book/[slug]/waitlist
    setTimeout(() => {
      setSubmitting(false);
      onJoined();
    }, 800);
  }

  return (
    <div>
      <h1 className="eb-title">Join the waitlist</h1>
      <p className="eb-sub">
        We'll notify you by text when a {type.name} spot opens up.
      </p>

      <div className="eb-note">
        <BellRing size={16} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
        There's no charge to join the waitlist. You'll only be booked if you confirm an
        offered time.
      </div>

      <div className="eb-form-grid">
        <div className="eb-field">
          <label className="eb-field-label" htmlFor="wl-fn">First name *</label>
          <input
            id="wl-fn"
            className="eb-input"
            autoComplete="given-name"
            value={state.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
            placeholder="Jordan"
          />
        </div>
        <div className="eb-field">
          <label className="eb-field-label" htmlFor="wl-phone">Mobile number *</label>
          <input
            id="wl-phone"
            className="eb-input"
            type="tel"
            autoComplete="tel"
            value={state.phone}
            onChange={(e) => update({ phone: e.target.value })}
            placeholder="(571) 555-1234"
          />
        </div>
        <div className="eb-field eb-field--full">
          <label className="eb-field-label" htmlFor="wl-notes">Preferred days or times — Optional</label>
          <input
            id="wl-notes"
            className="eb-input"
            value={state.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="e.g. Weekday mornings"
          />
        </div>
      </div>

      <div className="eb-actions">
        <button type="button" className="eb-btn eb-btn--ghost" onClick={onBack} disabled={submitting}>
          <ArrowLeft size={15} aria-hidden /> Back
        </button>
        <button
          type="button"
          className="eb-btn eb-btn--primary"
          disabled={submitting || invalid}
          onClick={join}
        >
          {submitting ? "Joining…" : "Join waitlist"}
        </button>
      </div>
    </div>
  );
}
