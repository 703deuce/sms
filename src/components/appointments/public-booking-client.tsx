"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";

type BookingType = {
  id: string;
  name: string;
  durationMinutes: number;
  config?: {
    description?: string;
    location?: string;
    priceDisplay?: string;
    bookingQuestions?: Array<{
      id: string;
      label: string;
      type: "text" | "textarea";
      required?: boolean;
    }>;
  };
};

type Slot = { startsAt: string; endsAt: string };

type Step = "service" | "datetime" | "info" | "done";

export function PublicBookingClient({
  slug,
  initialServiceId,
}: {
  slug: string;
  initialServiceId?: string;
}) {
  const [step, setStep] = useState<Step>("service");
  const [workspaceName, setWorkspaceName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [consentText, setConsentText] = useState("");
  const [termsUrl, setTermsUrl] = useState("/terms");
  const [privacyUrl, setPrivacyUrl] = useState("/privacy");
  const [types, setTypes] = useState<BookingType[]>([]);
  const [selectedType, setSelectedType] = useState<BookingType | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingAnswers, setBookingAnswers] = useState<Record<string, string>>({});
  const [smsConsent, setSmsConsent] = useState(false);
  const [humanVerification, setHumanVerification] = useState(false);
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [formStartedAt] = useState(() => Date.now());
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/book/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (!r.ok) {
          const json = await r.json().catch(() => ({}));
          throw new Error(json.error || "Booking unavailable");
        }
        return r.json();
      })
      .then((json) => {
        setWorkspaceName(json.data.workspace.name);
        setTimezone(json.data.timezone || "");
        setBusinessPhone(json.data.businessPhone || "");
        setBusinessAddress(json.data.businessAddress || "");
        setConsentText(json.data.consentText || "");
        setTermsUrl(json.data.termsUrl || "/terms");
        setPrivacyUrl(json.data.privacyUrl || "/privacy");
        const list = json.data.types || [];
        setTypes(list);
        if (initialServiceId) {
          const match = list.find((t: BookingType) => t.id === initialServiceId);
          if (match) {
            setSelectedType(match);
            setStep("datetime");
            void pickType(match);
          }
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, initialServiceId]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = new Date(slot.startsAt).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      const list = map.get(key) || [];
      list.push(slot);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [slots]);

  async function pickType(type: BookingType) {
    setSelectedType(type);
    setStartsAt("");
    setBookingAnswers({});
    setStep("datetime");
    setLoadingSlots(true);
    setError("");
    const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "availability",
        serviceName: type.name,
        daysAhead: 14,
      }),
    });
    const json = await res.json();
    setSlots(json.data?.slots || []);
    setLoadingSlots(false);
  }

  async function book() {
    const questions = selectedType?.config?.bookingQuestions || [];
    for (const q of questions) {
      if (q.required && !bookingAnswers[q.id]?.trim()) {
        setError(`Please answer: ${q.label}`);
        return;
      }
    }
    if (!selectedType || !startsAt || !phone.trim() || !firstName.trim()) {
      setError("Please complete all required fields.");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: selectedType.id,
        serviceName: selectedType.name,
        startsAt,
        firstName,
        lastName,
        phone,
        email,
        notes,
        bookingAnswers: Object.keys(bookingAnswers).length ? bookingAnswers : undefined,
        smsConsent,
        humanVerification: challengeRequired ? humanVerification : undefined,
        formStartedAt,
        website: honeypot,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 428 && json.challengeRequired) {
      setChallengeRequired(true);
      setError("Please confirm you are a real person to continue.");
      setSubmitting(false);
      return;
    }
    if (!res.ok) {
      setError(json.error || "Could not complete booking");
      setSubmitting(false);
      return;
    }
    setStep("done");
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-500">Loading booking page…</p>
      </div>
    );
  }

  if (error && step === "service" && types.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="max-w-md rounded-xl p-6 text-center">
          <p className="text-sm text-rose-600">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Book online</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-slate-900">{workspaceName}</h1>
          {timezone ? (
            <p className="mt-2 text-sm text-slate-500">All times shown in {timezone.replace(/_/g, " ")}</p>
          ) : null}
          {businessPhone || businessAddress ? (
            <p className="mt-1 text-sm text-slate-500">
              {[businessPhone, businessAddress].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>

        {step === "service" ? (
          <div className="space-y-3">
            {types.map((type) => (
              <button
                key={type.id}
                type="button"
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-sky-300"
                onClick={() => pickType(type)}
              >
                <p className="font-semibold text-slate-900">{type.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {type.durationMinutes} minutes
                  {type.config?.location ? ` · ${type.config.location}` : ""}
                  {type.config?.priceDisplay ? ` · ${type.config.priceDisplay}` : ""}
                </p>
                {type.config?.description ? (
                  <p className="mt-2 text-sm text-slate-600">{type.config.description}</p>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {step === "datetime" ? (
          <Card className="rounded-xl border-slate-200 p-4">
            <button type="button" className="mb-4 text-sm text-sky-700 hover:underline" onClick={() => setStep("service")}>
              ← Change service
            </button>
            <h2 className="font-semibold text-slate-900">{selectedType?.name}</h2>
            {loadingSlots ? (
              <p className="mt-4 text-sm text-slate-500">Loading available times…</p>
            ) : slots.length === 0 ? (
              <p className="mt-4 text-sm text-amber-700">No open times in the next two weeks.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {slotsByDay.map(([day, daySlots]) => (
                  <div key={day}>
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">{day}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {daySlots.map((slot) => (
                        <button
                          key={slot.startsAt}
                          type="button"
                          className={`rounded-md border px-2 py-2 text-sm ${
                            startsAt === slot.startsAt
                              ? "border-sky-500 bg-sky-50 text-sky-900"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                          onClick={() => setStartsAt(slot.startsAt)}
                        >
                          {new Date(slot.startsAt).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button className="mt-6 w-full" disabled={!startsAt} onClick={() => setStep("info")}>
              Continue
            </Button>
          </Card>
        ) : null}

        {step === "info" ? (
          <Card className="rounded-xl border-slate-200 p-4">
            <button type="button" className="mb-4 text-sm text-sky-700 hover:underline" onClick={() => setStep("datetime")}>
              ← Change time
            </button>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="first">First name</Label>
                  <Input id="first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="last">Last name</Label>
                  <Input id="last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Mobile phone *</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="sr-only" aria-hidden="true">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              {(selectedType?.config?.bookingQuestions || []).map((q) => (
                <div key={q.id}>
                  <Label htmlFor={q.id}>
                    {q.label}
                    {q.required ? " *" : ""}
                  </Label>
                  {q.type === "textarea" ? (
                    <Textarea
                      id={q.id}
                      rows={3}
                      value={bookingAnswers[q.id] || ""}
                      onChange={(e) =>
                        setBookingAnswers({ ...bookingAnswers, [q.id]: e.target.value })
                      }
                    />
                  ) : (
                    <Input
                      id={q.id}
                      value={bookingAnswers[q.id] || ""}
                      onChange={(e) =>
                        setBookingAnswers({ ...bookingAnswers, [q.id]: e.target.value })
                      }
                    />
                  )}
                </div>
              ))}
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                />
                <span>
                  {consentText || "I agree to receive appointment confirmations and reminders by SMS."}{" "}
                  <a href={termsUrl} className="text-sky-700 hover:underline" target="_blank" rel="noreferrer">
                    Terms
                  </a>{" "}
                  and{" "}
                  <a href={privacyUrl} className="text-sky-700 hover:underline" target="_blank" rel="noreferrer">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
              {challengeRequired ? (
                <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={humanVerification}
                    onChange={(e) => setHumanVerification(e.target.checked)}
                  />
                  <span>I confirm I am a real person booking this appointment.</span>
                </label>
              ) : null}
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <Button className="w-full" disabled={submitting} onClick={book}>
                {submitting ? "Booking…" : "Book appointment"}
              </Button>
            </div>
          </Card>
        ) : null}

        {step === "done" ? (
          <Card className="rounded-xl border-emerald-200 bg-emerald-50/40 p-6 text-center">
            <h2 className="text-xl font-semibold text-emerald-900">You&apos;re booked!</h2>
            <p className="mt-2 text-sm text-emerald-800">
              {smsConsent
                ? "We sent a confirmation text with details and links to confirm, reschedule, or cancel."
                : "Your appointment is booked. Save your confirmation details below."}
            </p>
            {selectedType && startsAt ? (
              <a
                className="mt-4 inline-block text-sm text-sky-800 hover:underline"
                href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedType.name)}&dates=${new Date(startsAt).toISOString().replace(/[-:]/g, "").split(".")[0]}Z/${new Date(new Date(startsAt).getTime() + selectedType.durationMinutes * 60000).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`}
                target="_blank"
                rel="noreferrer"
              >
                Add to Google Calendar
              </a>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
