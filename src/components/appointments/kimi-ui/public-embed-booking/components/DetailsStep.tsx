"use client";

import { useState } from "react";
import { AlertCircle, ArrowLeft, CalendarDays, Clock, MapPin, Minus, Plus, Repeat, User, Users } from "lucide-react";
import { formatPrice, formatSlotDate, formatSlotTime, type BookingQuestion } from "../mock-data";
import type { BookingState } from "../page";

export default function DetailsStep({
  state,
  update,
  staffName,
  locationName,
  consentText,
  termsUrl,
  privacyUrl,
  submitting,
  onBack,
  onSubmit,
}: {
  state: BookingState;
  update: (patch: Partial<BookingState>) => void;
  staffName?: string;
  locationName?: string;
  consentText: string;
  termsUrl: string;
  privacyUrl: string;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [touched, setTouched] = useState(false);
  const type = state.type!;
  const slot = state.slot!;
  const questions: BookingQuestion[] = type.config?.bookingQuestions || [];
  const price = formatPrice(type.config?.payment);
  const group = type.config?.groupBooking;
  const recurringLabel =
    state.recurringMode === "once"
      ? null
      : `${state.recurringOccurrences} sessions · ${
          state.recurringMode === "weekly"
            ? "weekly"
            : state.recurringMode === "biweekly"
              ? "every 2 weeks"
              : "monthly"
        }`;

  const missingRequired = questions.some(
    (q) => q.required && !(state.answers[q.id] || "").trim(),
  );
  const invalid =
    !state.firstName.trim() ||
    !state.lastName.trim() ||
    !/^\S+@\S+\.\S+$/.test(state.email) ||
    !state.phone.trim() ||
    missingRequired;

  function setAnswer(id: string, value: string) {
    update({ answers: { ...state.answers, [id]: value } });
  }

  return (
    <div>
      <h1 className="eb-title">Your details</h1>
      <p className="eb-sub">Tell us who this appointment is for.</p>

      <div className="eb-summary">
        <div className="eb-summary__title">
          {type.name}
          {price ? <span className="eb-pill">{price} due</span> : null}
        </div>
        <div className="eb-summary__row">
          <CalendarDays size={13} aria-hidden />
          {formatSlotDate(slot.startsAt)}
        </div>
        <div className="eb-summary__row">
          <Clock size={13} aria-hidden />
          {formatSlotTime(slot.startsAt)} – {formatSlotTime(slot.endsAt)} · Eastern Time
        </div>
        {recurringLabel ? (
          <div className="eb-summary__row">
            <Repeat size={13} aria-hidden /> {recurringLabel}
          </div>
        ) : null}
        {staffName ? (
          <div className="eb-summary__row">
            <User size={13} aria-hidden /> {staffName}
          </div>
        ) : null}
        {locationName ? (
          <div className="eb-summary__row">
            <MapPin size={13} aria-hidden /> {locationName}
          </div>
        ) : null}
      </div>

      {group?.enabled ? (
        <div className="eb-attendees">
          <span className="eb-attendees__label">
            <Users size={14} aria-hidden /> How many people are coming?
          </span>
          <div className="eb-stepper">
            <button
              type="button"
              className="eb-stepper__btn"
              aria-label="Fewer attendees"
              disabled={state.attendeeCount <= 1}
              onClick={() => update({ attendeeCount: Math.max(1, state.attendeeCount - 1) })}
            >
              <Minus size={14} aria-hidden />
            </button>
            <span className="eb-stepper__value" aria-live="polite">
              {state.attendeeCount} of {group.capacity}
            </span>
            <button
              type="button"
              className="eb-stepper__btn"
              aria-label="More attendees"
              disabled={state.attendeeCount >= group.capacity}
              onClick={() =>
                update({ attendeeCount: Math.min(group.capacity, state.attendeeCount + 1) })
              }
            >
              <Plus size={14} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <div className="eb-form-grid">
        <div className="eb-field">
          <label className="eb-field-label" htmlFor="eb-fn">First name *</label>
          <input
            id="eb-fn"
            className="eb-input"
            autoComplete="given-name"
            value={state.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
            placeholder="Jordan"
          />
        </div>
        <div className="eb-field">
          <label className="eb-field-label" htmlFor="eb-ln">Last name *</label>
          <input
            id="eb-ln"
            className="eb-input"
            autoComplete="family-name"
            value={state.lastName}
            onChange={(e) => update({ lastName: e.target.value })}
            placeholder="Lee"
          />
        </div>
        <div className="eb-field">
          <label className="eb-field-label" htmlFor="eb-email">Email address *</label>
          <input
            id="eb-email"
            className="eb-input"
            type="email"
            autoComplete="email"
            value={state.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="you@example.com"
          />
          {touched && state.email && !/^\S+@\S+\.\S+$/.test(state.email) ? (
            <p className="eb-field__err">
              <AlertCircle size={12} aria-hidden /> Enter a complete email address.
            </p>
          ) : null}
        </div>
        <div className="eb-field">
          <label className="eb-field-label" htmlFor="eb-phone">Mobile number *</label>
          <input
            id="eb-phone"
            className="eb-input"
            type="tel"
            autoComplete="tel"
            value={state.phone}
            onChange={(e) => update({ phone: e.target.value })}
            placeholder="(571) 555-1234"
          />
          <p className="eb-field__hint">Used for appointment confirmations and reminders.</p>
        </div>

        {questions.map((q) => (
          <div key={q.id} className="eb-field eb-field--full">
            <label className="eb-field-label" htmlFor={`eb-q-${q.id}`}>
              {q.label}
              {q.required ? " *" : ""}
            </label>
            {q.description ? (
              <p className="eb-field__hint" style={{ marginTop: -2, marginBottom: 6 }}>
                {q.description}
              </p>
            ) : null}
            {q.type === "textarea" ? (
              <textarea
                id={`eb-q-${q.id}`}
                className="eb-input"
                rows={3}
                placeholder={q.placeholder}
                value={state.answers[q.id] || ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            ) : q.type === "select" ? (
              <select
                id={`eb-q-${q.id}`}
                className="eb-select"
                value={state.answers[q.id] || ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              >
                <option value="">Select…</option>
                {(q.options || []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : q.type === "radio" ? (
              <div role="radiogroup" aria-label={q.label}>
                {(q.options || []).map((o) => (
                  <label key={o} className="eb-choice-row">
                    <input
                      type="radio"
                      name={`eb-q-${q.id}`}
                      checked={(state.answers[q.id] || "") === o}
                      onChange={() => setAnswer(q.id, o)}
                    />
                    {o}
                  </label>
                ))}
              </div>
            ) : q.type === "checkbox" ? (
              <label className="eb-choice-row">
                <input
                  type="checkbox"
                  checked={(state.answers[q.id] || "") === "yes"}
                  onChange={(e) => setAnswer(q.id, e.target.checked ? "yes" : "")}
                />
                {q.placeholder || "Yes"}
              </label>
            ) : (
              <input
                id={`eb-q-${q.id}`}
                className="eb-input"
                placeholder={q.placeholder}
                value={state.answers[q.id] || ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            )}
          </div>
        ))}

        <div className="eb-field eb-field--full">
          <label className="eb-field-label" htmlFor="eb-notes">Notes — Optional</label>
          <textarea
            id="eb-notes"
            className="eb-input"
            rows={2}
            placeholder="Anything else we should know?"
            value={state.notes}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </div>
      </div>

      <div className="eb-consent">
        <label className="eb-consent__label">
          <input
            type="checkbox"
            checked={state.smsConsent}
            onChange={(e) => update({ smsConsent: e.target.checked })}
          />
          <span>
            {consentText}{" "}
            <a href={termsUrl} target="_blank" rel="noreferrer">Terms</a> ·{" "}
            <a href={privacyUrl} target="_blank" rel="noreferrer">Privacy Policy</a>
          </span>
        </label>
      </div>

      {touched && invalid ? (
        <div className="eb-alert" role="alert">
          <AlertCircle size={15} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
          Please complete the required fields above before booking.
        </div>
      ) : null}

      <div className="eb-actions">
        <button type="button" className="eb-btn eb-btn--ghost" onClick={onBack} disabled={submitting}>
          <ArrowLeft size={15} aria-hidden /> Back
        </button>
        <button
          type="button"
          className="eb-btn eb-btn--primary"
          disabled={submitting}
          onClick={() => {
            if (invalid) {
              setTouched(true);
              return;
            }
            onSubmit();
          }}
        >
          {submitting ? "Booking…" : price ? "Continue to payment" : "Book appointment"}
        </button>
      </div>
    </div>
  );
}
