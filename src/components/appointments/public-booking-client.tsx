"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock,
  Globe2,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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

type Step = "service" | "datetime" | "info" | "done" | "ai";

const STEP_LABELS: Array<{ key: Exclude<Step, "done">; label: string }> = [
  { key: "service", label: "Service" },
  { key: "datetime", label: "Date & time" },
  { key: "info", label: "Your details" },
];

function StepIndicator({ step }: { step: Step }) {
  const activeIndex =
    step === "done"
      ? STEP_LABELS.length
      : STEP_LABELS.findIndex((s) => s.key === step);
  return (
    <ol className="mb-6 flex items-center justify-center gap-1.5">
      {STEP_LABELS.map((s, i) => {
        const complete = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                complete
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {complete ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-[12px] font-semibold sm:inline",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < STEP_LABELS.length - 1 ? (
              <span className="mx-1 h-px w-6 bg-border" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

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
  const [aiMessage, setAiMessage] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [aiSlots, setAiSlots] = useState<Slot[]>([]);

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

  async function sendAiMessage() {
    const text = aiInput.trim();
    if (!text) return;
    setAiLoading(true);
    setError("");
    setAiInput("");
    const nextHistory = [...aiHistory, { role: "user" as const, content: text }];
    setAiHistory(nextHistory);
    try {
      const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, conversationHistory: nextHistory }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI booking unavailable");
      const data = json.data;
      setAiMessage(data.message || "");
      setAiHistory((h) => [...h, { role: "assistant", content: data.message || "" }]);
      if (data.slots?.length) {
        setAiSlots(data.slots);
      }
      if (data.serviceName && !selectedType) {
        const match = types.find((t) => t.name === data.serviceName);
        if (match) setSelectedType(match);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process request");
    } finally {
      setAiLoading(false);
    }
  }

  function selectAiSlot(slot: Slot) {
    setStartsAt(slot.startsAt);
    if (selectedType) {
      setStep("info");
    } else if (types.length === 1) {
      setSelectedType(types[0]);
      setStep("info");
    } else {
      setStep("service");
      setError("Please select a service type first.");
    }
  }

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
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Loading booking page…
        </div>
      </div>
    );
  }

  if (error && step === "service" && types.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <h1 className="font-display text-base font-semibold text-foreground">
            Booking unavailable
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {error}
          </p>
        </Card>
      </div>
    );
  }

  const selectedWhen = startsAt
    ? new Date(startsAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 via-muted/20 to-card px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Book online
          </p>
          <h1 className="mt-2 font-display text-[28px] font-semibold tracking-tight text-foreground">
            {workspaceName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
            {timezone ? (
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5" />
                {timezone.replace(/_/g, " ")}
              </span>
            ) : null}
            {businessPhone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {businessPhone}
              </span>
            ) : null}
            {businessAddress ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {businessAddress}
              </span>
            ) : null}
          </div>
        </div>

        <StepIndicator step={step} />

        {step === "service" ? (
          <div className="space-y-3">
            <button
              type="button"
              className="group surface w-full rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-left transition-all hover:border-primary/50 hover:bg-primary/10"
              onClick={() => setStep("ai")}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-[15px] font-semibold text-foreground">
                    Tell us what works for you
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Describe when you&apos;d like to come — we&apos;ll find real available times.
                  </p>
                </div>
              </div>
            </button>

            <p className="text-center text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              or choose a service
            </p>

            {types.map((type) => (
              <button
                key={type.id}
                type="button"
                className="group surface w-full rounded-xl bg-card p-5 text-left transition-all duration-150 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => pickType(type)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-[15px] font-semibold tracking-tight text-foreground">
                      {type.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {type.durationMinutes} min
                      </span>
                      {type.config?.location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {type.config.location}
                        </span>
                      ) : null}
                      {type.config?.priceDisplay ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {type.config.priceDisplay}
                        </span>
                      ) : null}
                    </div>
                    {type.config?.description ? (
                      <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                        {type.config.description}
                      </p>
                    ) : null}
                  </div>
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {step === "ai" ? (
          <Card className="p-5 sm:p-6">
            <button
              type="button"
              className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
              onClick={() => setStep("service")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <h2 className="font-display text-base font-semibold">Describe your ideal appointment time</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Examples: &quot;I need a consultation Friday afternoon&quot; or &quot;Anything Tuesday after 3?&quot;
            </p>

            {aiHistory.length > 0 ? (
              <div className="mt-4 max-h-64 space-y-3 overflow-y-auto rounded-lg bg-muted/40 p-3">
                {aiHistory.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg px-3 py-2 text-[13px] whitespace-pre-wrap",
                      m.role === "user"
                        ? "ml-6 bg-primary text-primary-foreground"
                        : "mr-6 bg-card border border-border",
                    )}
                  >
                    {m.content}
                  </div>
                ))}
              </div>
            ) : null}

            {aiSlots.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-[13px] font-semibold">Available times</p>
                {aiSlots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left text-[13px] font-medium hover:border-primary/40"
                    onClick={() => selectAiSlot(slot)}
                  >
                    {new Date(slot.startsAt).toLocaleString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <Input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Type your request…"
                onKeyDown={(e) => e.key === "Enter" && sendAiMessage()}
                disabled={aiLoading}
              />
              <Button onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim()}>
                {aiLoading ? "…" : "Send"}
              </Button>
            </div>

            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

            <p className="mt-4 text-center text-[12px] text-muted-foreground">
              Prefer to pick manually?{" "}
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setStep("service")}>
                Choose a time
              </button>
            </p>
          </Card>
        ) : null}

        {step === "datetime" ? (
          <Card className="p-5 sm:p-6">
            <button
              type="button"
              className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
              onClick={() => setStep("service")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Change service
            </button>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
                {selectedType?.name}
              </h2>
              {selectedType ? (
                <span className="text-[12px] font-medium text-muted-foreground">
                  {selectedType.durationMinutes} min
                </span>
              ) : null}
            </div>
            {loadingSlots ? (
              <div className="mt-6 flex items-center gap-2.5 text-sm text-muted-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                Loading available times…
              </div>
            ) : slots.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-foreground">
                  No open times in the next two weeks
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Please check back soon or contact us directly.
                </p>
              </div>
            ) : (
              <div className="mt-5 max-h-[380px] space-y-5 overflow-y-auto pr-1">
                {slotsByDay.map(([day, daySlots]) => (
                  <div key={day}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {day}
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {daySlots.map((slot) => {
                        const selected = startsAt === slot.startsAt;
                        return (
                          <button
                            key={slot.startsAt}
                            type="button"
                            className={cn(
                              "rounded-lg border px-2 py-2 text-[13px] font-medium tabular-nums transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              selected
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5",
                            )}
                            onClick={() => setStartsAt(slot.startsAt)}
                          >
                            {new Date(slot.startsAt).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              size="lg"
              className="mt-6 w-full"
              disabled={!startsAt}
              onClick={() => setStep("info")}
            >
              Continue
            </Button>
          </Card>
        ) : null}

        {step === "info" ? (
          <Card className="p-5 sm:p-6">
            <button
              type="button"
              className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
              onClick={() => setStep("datetime")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Change time
            </button>

            <div className="mb-5 flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarCheck className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {selectedType?.name}
                </p>
                <p className="text-[12px] text-muted-foreground">{selectedWhen}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="first">First name *</Label>
                  <Input
                    id="first"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="last">Last name</Label>
                  <Input
                    id="last"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Mobile phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
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
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {(selectedType?.config?.bookingQuestions || []).map((q) => (
                <div key={q.id}>
                  <Label htmlFor={`q-${q.id}`}>
                    {q.label}
                    {q.required ? " *" : ""}
                  </Label>
                  {q.type === "textarea" ? (
                    <Textarea
                      id={`q-${q.id}`}
                      rows={3}
                      value={bookingAnswers[q.id] || ""}
                      onChange={(e) =>
                        setBookingAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <Input
                      id={`q-${q.id}`}
                      value={bookingAnswers[q.id] || ""}
                      onChange={(e) =>
                        setBookingAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              ))}

              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-muted/30 px-3.5 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                />
                <span className="text-[12px] leading-relaxed text-muted-foreground">
                  {consentText ||
                    "I agree to receive appointment confirmations and reminders by SMS. Message and data rates may apply. Reply STOP to opt out."}{" "}
                  <a
                    href={termsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-primary hover:underline"
                  >
                    Terms
                  </a>{" "}
                  ·{" "}
                  <a
                    href={privacyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-primary hover:underline"
                  >
                    Privacy
                  </a>
                </span>
              </label>

              {challengeRequired ? (
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border accent-primary"
                    checked={humanVerification}
                    onChange={(e) => setHumanVerification(e.target.checked)}
                  />
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-900">
                    <ShieldCheck className="h-4 w-4" />
                    I confirm I am a real person
                  </span>
                </label>
              ) : null}

              {error ? (
                <p className="rounded-lg bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
                  {error}
                </p>
              ) : null}

              <Button
                size="lg"
                className="w-full"
                disabled={submitting}
                onClick={book}
              >
                {submitting ? "Booking…" : "Confirm booking"}
              </Button>
            </div>
          </Card>
        ) : null}

        {step === "done" ? (
          <Card className="p-8 text-center sm:p-10">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
              <Check className="h-6 w-6" />
            </div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
              You&apos;re booked!
            </h2>
            <p className="mt-2 text-sm font-medium text-foreground">
              {selectedType?.name}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">{selectedWhen}</p>
            {timezone ? (
              <p className="mt-1 text-[12px] text-muted-foreground">
                {timezone.replace(/_/g, " ")}
              </p>
            ) : null}
            <div className="mx-auto mt-6 max-w-xs rounded-xl bg-muted/50 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
              You&apos;ll receive a confirmation text shortly with options to
              reschedule or cancel.
            </div>
          </Card>
        ) : null}

        <p className="mt-8 text-center text-[11px] text-muted-foreground/70">
          Powered by your booking provider
        </p>
      </div>
    </div>
  );
}
