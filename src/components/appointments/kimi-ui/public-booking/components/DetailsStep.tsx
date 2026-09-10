"use client";

import { useState } from "react";
import { BookingQuestion, BookingType, smsConsentDisclosure, workspace } from "../mock-data";
import { ArrowLeft, CalendarCheck, Clock, MapPin, ShieldCheck, Users } from "lucide-react";

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: BookingQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `q-${question.id}`;
  const inputCls =
    "mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div>
      <label htmlFor={id} className="text-[12px] font-semibold text-foreground">
        {question.label}
        {question.required ? <span className="text-danger"> *</span> : null}
      </label>
      {question.description ? <p className="mt-0.5 text-[12px] text-muted-foreground">{question.description}</p> : null}

      {question.type === "textarea" ? (
        <textarea id={id} rows={3} className={inputCls} placeholder={question.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : question.type === "select" ? (
        <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {(question.options || []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : question.type === "radio" ? (
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={question.label}>
          {(question.options || []).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={value === o}
              onClick={() => onChange(o)}
              className={`rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                value === o ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-foreground hover:bg-muted/60"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      ) : question.type === "checkbox" ? (
        <label className="mt-2 flex items-center gap-2 text-[13px]">
          <input
            id={id}
            type="checkbox"
            checked={value === "yes"}
            onChange={(e) => onChange(e.target.checked ? "yes" : "")}
            className="h-4 w-4 rounded border-border accent-[#10665f]"
          />
          {question.placeholder || "Yes"}
        </label>
      ) : question.type === "multiselect" ? (
        <div className="mt-2 space-y-2">
          {(question.options || []).map((o) => {
            const selected = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
            return (
              <label key={o} className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={selected.includes(o)}
                  onChange={(e) => {
                    const next = e.target.checked ? [...selected, o] : selected.filter((s) => s !== o);
                    onChange(next.join(", "));
                  }}
                  className="h-4 w-4 rounded border-border accent-[#10665f]"
                />
                {o}
              </label>
            );
          })}
        </div>
      ) : (
        <input
          id={id}
          type={question.type === "email" ? "email" : question.type === "phone" ? "tel" : question.type === "number" ? "number" : question.type === "date" ? "date" : "text"}
          className={inputCls}
          placeholder={question.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export function DetailsStep({
  type,
  startsAt,
  attendeeCount,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  type: BookingType;
  startsAt: string;
  attendeeCount: number;
  onBack: () => void;
  onSubmit: (payload: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    notes: string;
    answers: Record<string, string>;
    smsConsent: boolean;
  }) => void;
  submitting: boolean;
  error: string;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [smsConsent, setSmsConsent] = useState(false);
  const [touched, setTouched] = useState(false);

  const missingRequired = (type.bookingQuestions || []).some((q) => q.required && !answers[q.id]);
  const valid = firstName.trim() && lastName.trim() && phone.trim().length >= 7 && /.+@.+\..+/.test(email) && !missingRequired;

  const when = new Date(startsAt);
  const whenLabel = when.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

  const inputCls =
    "mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="tv-fade-up mx-auto max-w-2xl">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to times
      </button>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display truncate text-[15px] font-semibold text-foreground">{type.name}</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {whenLabel} · {workspace.timezoneLabel}</span>
              {type.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {type.location}</span> : null}
              {attendeeCount > 1 ? <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {attendeeCount} attendees</span> : null}
            </p>
          </div>
        </div>

        <form
          className="space-y-5 px-5 py-6 sm:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!valid || submitting) return;
            onSubmit({ firstName, lastName, phone, email, notes, answers, smsConsent });
          }}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fn" className="text-[12px] font-semibold text-foreground">First name <span className="text-danger">*</span></label>
              <input id="fn" autoComplete="given-name" className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              {touched && !firstName.trim() ? <p className="mt-1 text-[12px] text-danger">Enter your first name.</p> : null}
            </div>
            <div>
              <label htmlFor="ln" className="text-[12px] font-semibold text-foreground">Last name <span className="text-danger">*</span></label>
              <input id="ln" autoComplete="family-name" className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              {touched && !lastName.trim() ? <p className="mt-1 text-[12px] text-danger">Enter your last name.</p> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ph" className="text-[12px] font-semibold text-foreground">Mobile number <span className="text-danger">*</span></label>
              <input id="ph" type="tel" autoComplete="tel" placeholder="(555) 123-4567" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
              {touched && phone.trim().length < 7 ? <p className="mt-1 text-[12px] text-danger">Enter a valid mobile number.</p> : null}
            </div>
            <div>
              <label htmlFor="em" className="text-[12px] font-semibold text-foreground">Email address <span className="text-danger">*</span></label>
              <input id="em" type="email" autoComplete="email" placeholder="name@example.com" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
              {touched && !/.+@.+\..+/.test(email) ? <p className="mt-1 text-[12px] text-danger">Enter a valid email address.</p> : null}
            </div>
          </div>

          {(type.bookingQuestions || []).map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id] || ""}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            />
          ))}
          {touched && missingRequired ? (
            <p className="text-[12px] text-danger">Please answer the required questions above.</p>
          ) : null}

          <div>
            <label htmlFor="notes" className="text-[12px] font-semibold text-foreground">Notes <span className="font-normal text-muted-foreground">— Optional</span></label>
            <textarea id="notes" rows={2} className={inputCls} placeholder="Anything else we should know before your visit?" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* SMS consent — unchecked by default, affirmative action required */}
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(e) => setSmsConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-[#10665f]"
              />
              <span className="text-[12px] leading-relaxed text-muted-foreground">
                <span className="mb-1 block text-[12px] font-semibold text-foreground">
                  Text message appointment updates <span className="font-normal text-muted-foreground">— Optional</span>
                </span>
                {smsConsentDisclosure}{" "}
                See our <a href="#" className="font-medium text-primary hover:underline">Terms</a> and{" "}
                <a href="#" className="font-medium text-primary hover:underline">Privacy Policy</a>.
              </span>
            </label>
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
            <p className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
              <ShieldCheck className="h-3.5 w-3.5" /> Your information is never shared.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onBack}
                disabled={submitting}
                className="rounded-lg border border-border bg-card px-4 py-2 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg px-5 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {submitting ? "Booking…" : type.payment && type.payment.mode !== "none" ? "Continue to payment" : "Book appointment"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
