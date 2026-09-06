import { useMemo, useState } from "react";
import type { BookingType } from "../mock-data";
import { workspace } from "../mock-data";
import { BookingQuestionField } from "./BookingQuestionField";
import { Button, Input, Label, Textarea } from "./ui";
import { formatSlotTime, formatFullDate } from "./utils";
import { ArrowLeft, CalendarCheck, Clock, MapPin, ShieldCheck } from "lucide-react";

export function InfoStep({
  type,
  startsAt,
  timezone,
  submitting,
  error,
  onBack,
  onBook,
}: {
  type: BookingType;
  startsAt: string;
  timezone: string;
  submitting: boolean;
  error: string;
  onBack: () => void;
  onBook: (payload: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    notes: string;
    smsConsent: boolean;
    answers: Record<string, string>;
    recurringMode: string;
    recurringOccurrences: number;
    attendeeCount: number;
  }) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recurringMode, setRecurringMode] = useState("once");
  const [recurringOccurrences, setRecurringOccurrences] = useState(4);
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const questions = type.config?.bookingQuestions || [];
  const recurring = type.config?.recurring?.enabled ? type.config.recurring : null;
  const group = type.config?.groupBooking?.enabled ? type.config.groupBooking : null;

  const missingRequired = useMemo(
    () => questions.filter((q) => q.required && !(answers[q.id] || "").trim()),
    [questions, answers],
  );

  function validate() {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = "Enter your first name.";
    if (!lastName.trim()) next.lastName = "Enter your last name.";
    if (!phone.trim()) next.phone = "Enter a mobile number for appointment updates.";
    else if (phone.replace(/\D/g, "").length < 10) next.phone = "Enter a complete phone number including area code.";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a complete email address.";
    if (missingRequired.length > 0) next.questions = "Answer the required questions above.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit() {
    if (!validate()) return;
    onBook({ firstName, lastName, phone, email, notes, smsConsent, answers, recurringMode, recurringOccurrences, attendeeCount });
  }

  return (
    <div className="fade-in">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Change time
      </button>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{type.name}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />
              {formatFullDate(startsAt, timezone)} · {formatSlotTime(startsAt, timezone)}
            </span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {type.config?.location || "In person"}</span>
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">First name *</Label>
          <Input id="firstName" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          {fieldErrors.firstName ? <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.firstName}</p> : null}
        </div>
        <div>
          <Label htmlFor="lastName">Last name *</Label>
          <Input id="lastName" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          {fieldErrors.lastName ? <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.lastName}</p> : null}
        </div>
        <div>
          <Label htmlFor="phone">Mobile number *</Label>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="(615) 555-0142" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {fieldErrors.phone ? <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.phone}</p> : null}
        </div>
        <div>
          <Label htmlFor="email">Email address — optional</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {fieldErrors.email ? <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.email}</p> : null}
        </div>
      </div>

      {group ? (
        <div className="mt-4">
          <Label htmlFor="attendees">How many people are coming?</Label>
          <select
            id="attendees"
            className="mt-1.5 h-9 w-full rounded-lg border border-border bg-card px-3 text-[13px] shadow-sm sm:max-w-[200px]"
            value={attendeeCount}
            onChange={(e) => setAttendeeCount(Number(e.target.value))}
          >
            {Array.from({ length: group.maxAttendees }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? "person" : "people"}</option>
            ))}
          </select>
        </div>
      ) : null}

      {recurring ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <p className="text-[13px] font-semibold text-foreground">Repeat this appointment</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["once", ...recurring.allowedFrequencies].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRecurringMode(opt)}
                className={
                  recurringMode === opt
                    ? "rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground"
                    : "rounded-full bg-muted px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
                }
              >
                {opt === "once" ? "One time" : opt === "weekly" ? "Weekly" : opt === "biweekly" ? "Every 2 weeks" : "Monthly"}
              </button>
            ))}
          </div>
          {recurringMode !== "once" ? (
            <div className="mt-3 flex items-center gap-2 text-[13px]">
              <Label htmlFor="occurrences" className="font-normal text-muted-foreground">Total visits</Label>
              <select
                id="occurrences"
                className="h-8 rounded-lg border border-border bg-card px-2 text-[13px]"
                value={recurringOccurrences}
                onChange={(e) => setRecurringOccurrences(Number(e.target.value))}
              >
                {Array.from({ length: recurring.maxOccurrences - 1 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      {questions.length > 0 ? (
        <div className="mt-5 space-y-4">
          <p className="text-[13px] font-semibold text-foreground">A few quick questions</p>
          {questions.map((q) => (
            <BookingQuestionField
              key={q.id}
              question={q}
              value={answers[q.id] || ""}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
            />
          ))}
          {fieldErrors.questions ? <p className="text-[12px] text-rose-600">{fieldErrors.questions}</p> : null}
        </div>
      ) : null}

      <div className="mt-5">
        <Label htmlFor="notes">Notes for the office — optional</Label>
        <Textarea id="notes" rows={2} placeholder="Anything else we should know?" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span className="text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Text me appointment updates — optional.</span>{" "}
            {workspace.consentText}{" "}
            <a href={workspace.termsUrl} className="font-semibold text-primary hover:underline">Terms</a> ·{" "}
            <a href={workspace.privacyUrl} className="font-semibold text-primary hover:underline">Privacy Policy</a>
          </span>
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700" role="alert">
          {error}
        </div>
      ) : null}

      <div className="mt-6">
        <Button size="lg" className="w-full" onClick={submit} disabled={submitting}>
          {submitting ? "Booking…" : "Book appointment"}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Your information is only used to schedule and manage this appointment.
        </p>
      </div>
    </div>
  );
}
