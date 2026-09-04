"use client";

import { BookingQuestionField } from "@/components/appointments/booking-question-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import type {
  BookingQuestion,
  GroupBookingConfig,
  PaymentRequirement,
  RecurringConfig,
  StaffAssignmentMode,
} from "@/lib/appointments/types";
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
  Users,
} from "lucide-react";
import { SquarePaymentStep } from "@/components/appointments/square-payment-step";
import { appointmentSmsConsentDisclosure } from "@/lib/appointments/sms-consent-disclosure";

type BookingType = {
  id: string;
  name: string;
  durationMinutes: number;
  config?: {
    description?: string;
    location?: string;
    priceDisplay?: string;
    bookingQuestions?: BookingQuestion[];
    staffAssignment?: StaffAssignmentMode;
    staffIds?: string[];
    locationIds?: string[];
    payment?: PaymentRequirement;
    groupBooking?: GroupBookingConfig;
    recurring?: RecurringConfig;
  };
};

type StaffOption = { id: string; name: string };
type LocationOption = { id: string; name: string; kind?: string; address?: string };

type Slot = { startsAt: string; endsAt: string; remaining?: number; capacity?: number };

type Step = "service" | "datetime" | "info" | "done" | "ai" | "waitlist" | "payment";

const STEP_LABELS: Array<{ key: Exclude<Step, "done" | "waitlist" | "ai">; label: string }> = [
  { key: "service", label: "Service" },
  { key: "datetime", label: "Date & time" },
  { key: "info", label: "Your details" },
];

function StepIndicator({ step }: { step: Step }) {
  const activeIndex =
    step === "done"
      ? STEP_LABELS.length
      : STEP_LABELS.findIndex((s) => s.key === step);
  if (step === "ai" || step === "waitlist") return null;
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

function formatPrice(payment?: PaymentRequirement) {
  if (!payment || payment.mode === "none") return null;
  const cents = payment.mode === "deposit"
    ? payment.depositCents || Math.round((payment.priceCents || 0) * ((payment.depositPercent || 0) / 100))
    : payment.priceCents;
  if (!cents) return null;
  const currency = (payment.currency || "usd").toUpperCase();
  const amount = (cents / 100).toFixed(2);
  return payment.mode === "deposit" ? `Deposit $${amount} ${currency}` : `$${amount} ${currency}`;
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
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [selectedType, setSelectedType] = useState<BookingType | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [recurringMode, setRecurringMode] = useState<"once" | "weekly" | "biweekly" | "monthly">("once");
  const [recurringOccurrences, setRecurringOccurrences] = useState(4);
  const [attendeeCount, setAttendeeCount] = useState(1);
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
  const [bookingConflicts, setBookingConflicts] = useState<Array<{ startsAt: string; reason: string }>>([]);
  const [paymentPending, setPaymentPending] = useState(false);
  const [pendingAppointmentId, setPendingAppointmentId] = useState("");
  const [squareConfig, setSquareConfig] = useState<{
    applicationId: string;
    locationId: string;
    amountCents: number;
    currency: string;
    sandbox?: boolean;
  } | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [aiSlots, setAiSlots] = useState<Slot[]>([]);
  const [waitlistPreferredDate, setWaitlistPreferredDate] = useState("");
  const [waitlistTimeStart, setWaitlistTimeStart] = useState("09:00");
  const [waitlistTimeEnd, setWaitlistTimeEnd] = useState("17:00");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

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
        setStaffOptions(json.data.staff || []);
        setLocationOptions(json.data.locations || []);
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

  const activeQuestions = useMemo(
    () =>
      (selectedType?.config?.bookingQuestions || []).filter((q) => q.active !== false).sort(
        (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0),
      ),
    [selectedType],
  );

  const eligibleStaff = useMemo(() => {
    const ids = selectedType?.config?.staffIds;
    let list = staffOptions;
    if (ids?.length) list = list.filter((s) => ids.includes(s.id));
    return list;
  }, [selectedType, staffOptions]);

  const eligibleLocations = useMemo(() => {
    const ids = selectedType?.config?.locationIds;
    if (!ids?.length) return locationOptions;
    return locationOptions.filter((l) => ids.includes(l.id));
  }, [selectedType, locationOptions]);

  const showStaffPicker = selectedType?.config?.staffAssignment === "customer_chooses" && eligibleStaff.length > 0;
  const showLocationPicker = eligibleLocations.length > 1;
  const groupEnabled = Boolean(selectedType?.config?.groupBooking?.enabled);
  const groupCapacity = selectedType?.config?.groupBooking?.capacity || 1;
  const recurringEnabled = Boolean(selectedType?.config?.recurring?.enabled);
  const paymentLabel = formatPrice(selectedType?.config?.payment);

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
      setAiHistory((h) => [...h, { role: "assistant", content: data.message || "" }]);
      if (data.slots?.length) setAiSlots(data.slots);
      if (data.serviceName && !selectedType) {
        const match = types.find((t) => t.name === data.serviceName);
        if (match) setSelectedType(match);
      }
      if (data.requiresPayment) {
        setError("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process request");
    } finally {
      setAiLoading(false);
    }
  }

  function selectAiSlot(slot: Slot) {
    setStartsAt(slot.startsAt);
    if (selectedType) setStep("info");
    else if (types.length === 1) {
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
    setSelectedStaffId("");
    setSelectedLocationId("");
    setRecurringMode("once");
    setAttendeeCount(1);
    setStep("datetime");
    setLoadingSlots(true);
    setError("");
    const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "availability",
        serviceId: type.id,
        serviceName: type.name,
        daysAhead: 14,
      }),
    });
    const json = await res.json();
    setSlots(json.data?.slots || []);
    setLoadingSlots(false);
  }

  async function joinWaitlist() {
    if (!selectedType || !phone.trim() || !firstName.trim()) {
      setError("Name and phone are required to join the waitlist.");
      return;
    }
    if (!smsConsent) {
      setError("Please accept SMS consent to join the waitlist.");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentTypeId: selectedType.id,
        serviceName: selectedType.name,
        preferredDate: waitlistPreferredDate || undefined,
        preferredTimeStart: waitlistTimeStart,
        preferredTimeEnd: waitlistTimeEnd,
        staffPreference: selectedStaffId || undefined,
        locationId: selectedLocationId || undefined,
        phone,
        email,
        firstName,
        lastName,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error || "Could not join waitlist");
      return;
    }
    setWaitlistSubmitted(true);
  }

  async function book() {
    for (const q of activeQuestions) {
      if (q.required && !bookingAnswers[q.id]?.trim()) {
        setError(`Please answer: ${q.label}`);
        return;
      }
    }
    if (!selectedType || !startsAt || !phone.trim() || !firstName.trim()) {
      setError("Please complete all required fields.");
      return;
    }
    if (showStaffPicker && !selectedStaffId) {
      setError("Please select a staff member.");
      return;
    }
    if (showLocationPicker && !selectedLocationId) {
      setError("Please select a location.");
      return;
    }
    setSubmitting(true);
    setError("");
    setBookingConflicts([]);
    const payload: Record<string, unknown> = {
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
      staffId: selectedStaffId || undefined,
      locationId: selectedLocationId || undefined,
      attendeeCount: groupEnabled ? attendeeCount : undefined,
    };
    if (recurringMode !== "once" && recurringEnabled) {
      payload.recurring = {
        frequency: recurringMode,
        occurrences: recurringOccurrences,
      };
    }
    const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    if (json.data?.conflicts?.length) {
      setBookingConflicts(json.data.conflicts);
    }
    if (json.data?.checkoutUrl) {
      setPaymentPending(true);
      window.location.href = json.data.checkoutUrl;
      return;
    }
    if (json.data?.square && json.data?.appointmentId) {
      setPendingAppointmentId(json.data.appointmentId);
      setSquareConfig(json.data.square);
      setStep("payment");
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
          <h1 className="font-display text-base font-semibold text-foreground">Booking unavailable</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{error}</p>
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Book online</p>
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
                className="group surface w-full rounded-xl bg-card p-5 text-left transition-all duration-150 hover:border-primary/40 hover:shadow-md"
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
                      {(type.config?.priceDisplay || formatPrice(type.config?.payment)) ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {type.config?.priceDisplay || formatPrice(type.config?.payment)}
                        </span>
                      ) : null}
                    </div>
                    {type.config?.description ? (
                      <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                        {type.config.description}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {step === "ai" ? (
          <Card className="p-5 sm:p-6">
            <button type="button" className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline" onClick={() => setStep("service")}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <h2 className="font-display text-base font-semibold">Describe your ideal appointment time</h2>
            {aiHistory.length > 0 ? (
              <div className="mt-4 max-h-64 space-y-3 overflow-y-auto rounded-lg bg-muted/40 p-3">
                {aiHistory.map((m, i) => (
                  <div key={i} className={cn("rounded-lg px-3 py-2 text-[13px] whitespace-pre-wrap", m.role === "user" ? "ml-6 bg-primary text-primary-foreground" : "mr-6 border border-border bg-card")}>
                    {m.content}
                  </div>
                ))}
              </div>
            ) : null}
            {aiSlots.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-[13px] font-semibold">Available times</p>
                {aiSlots.map((slot) => (
                  <button key={slot.startsAt} type="button" className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left text-[13px] font-medium hover:border-primary/40" onClick={() => selectAiSlot(slot)}>
                    {new Date(slot.startsAt).toLocaleString()}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Input value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Type your request…" onKeyDown={(e) => e.key === "Enter" && sendAiMessage()} disabled={aiLoading} />
              <Button onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim()}>{aiLoading ? "…" : "Send"}</Button>
            </div>
            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          </Card>
        ) : null}

        {step === "datetime" ? (
          <Card className="p-5 sm:p-6">
            <button type="button" className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline" onClick={() => setStep("service")}>
              <ArrowLeft className="h-3.5 w-3.5" /> Change service
            </button>
            <h2 className="font-display text-base font-semibold">{selectedType?.name}</h2>

            {showStaffPicker ? (
              <div className="mt-4">
                <Label>Choose staff *</Label>
                <div className="mt-2 grid gap-2">
                  {eligibleStaff.map((s) => (
                    <button key={s.id} type="button" className={cn("rounded-lg border px-3 py-2 text-left text-[13px]", selectedStaffId === s.id ? "border-primary bg-primary/5" : "border-border")} onClick={() => setSelectedStaffId(s.id)}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {showLocationPicker ? (
              <div className="mt-4">
                <Label>Choose location *</Label>
                <div className="mt-2 grid gap-2">
                  {eligibleLocations.map((l) => (
                    <button key={l.id} type="button" className={cn("rounded-lg border px-3 py-2 text-left text-[13px]", selectedLocationId === l.id ? "border-primary bg-primary/5" : "border-border")} onClick={() => setSelectedLocationId(l.id)}>
                      <span className="font-medium">{l.name}</span>
                      {l.address ? <span className="block text-[12px] text-muted-foreground">{l.address}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {recurringEnabled ? (
              <div className="mt-4 space-y-3 rounded-lg bg-muted/40 p-3">
                <Label>How often?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "once", label: "One time" },
                    { value: "weekly", label: "Weekly" },
                    { value: "biweekly", label: "Every 2 weeks" },
                    { value: "monthly", label: "Monthly" },
                  ].map((opt) => (
                    <button key={opt.value} type="button" className={cn("rounded-lg border px-2 py-2 text-[12px] font-medium", recurringMode === opt.value ? "border-primary bg-primary/5" : "border-border")} onClick={() => setRecurringMode(opt.value as typeof recurringMode)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {recurringMode !== "once" ? (
                  <div>
                    <Label htmlFor="occurrences">Number of occurrences</Label>
                    <Input id="occurrences" type="number" min={2} max={selectedType?.config?.recurring?.maxOccurrences || 52} value={recurringOccurrences} onChange={(e) => setRecurringOccurrences(Number(e.target.value) || 2)} />
                  </div>
                ) : null}
              </div>
            ) : null}

            {loadingSlots ? (
              <div className="mt-6 flex items-center gap-2.5 text-sm text-muted-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                Loading available times…
              </div>
            ) : slots.length === 0 ? (
              <div className="mt-5 space-y-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-foreground">No open times in the next two weeks</p>
                <p className="text-[13px] text-muted-foreground">Join the waitlist and we&apos;ll notify you when a slot opens.</p>
                <Button variant="outline" onClick={() => setStep("waitlist")}>Join waitlist</Button>
              </div>
            ) : (
              <div className="mt-5 max-h-[380px] space-y-5 overflow-y-auto pr-1">
                {slotsByDay.map(([day, daySlots]) => (
                  <div key={day}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{day}</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {daySlots.map((slot) => {
                        const selected = startsAt === slot.startsAt;
                        return (
                          <button key={slot.startsAt} type="button" className={cn("rounded-lg border px-2 py-2 text-[13px] font-medium tabular-nums", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40")} onClick={() => setStartsAt(slot.startsAt)}>
                            {new Date(slot.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            {slot.remaining !== undefined && groupEnabled ? (
                              <span className="block text-[10px] opacity-80">{slot.remaining} left</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {groupEnabled && groupCapacity > 1 ? (
              <div className="mt-4">
                <Label htmlFor="seats" className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Number of seats
                </Label>
                <Input id="seats" type="number" min={1} max={groupCapacity} value={attendeeCount} onChange={(e) => setAttendeeCount(Math.min(groupCapacity, Math.max(1, Number(e.target.value) || 1)))} className="mt-1.5" />
                <p className="mt-1 text-[12px] text-muted-foreground">Maximum {groupCapacity} per session</p>
              </div>
            ) : null}

            <Button size="lg" className="mt-6 w-full" disabled={!startsAt} onClick={() => setStep("info")}>
              Continue
            </Button>
          </Card>
        ) : null}

        {step === "waitlist" ? (
          <Card className="p-5 sm:p-6">
            <button type="button" className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline" onClick={() => setStep("datetime")}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            {waitlistSubmitted ? (
              <div className="text-center py-6">
                <Check className="mx-auto h-10 w-10 text-emerald-600" />
                <h2 className="mt-3 font-display text-lg font-semibold">You&apos;re on the waitlist</h2>
                <p className="mt-2 text-sm text-muted-foreground">We&apos;ll contact you when a matching slot opens.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="font-display text-base font-semibold">Join waitlist — {selectedType?.name}</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>First name *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
                  <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
                </div>
                <div><Label>Phone *</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>Preferred date</Label><Input type="date" value={waitlistPreferredDate} onChange={(e) => setWaitlistPreferredDate(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Preferred from</Label><Input type="time" value={waitlistTimeStart} onChange={(e) => setWaitlistTimeStart(e.target.value)} /></div>
                  <div><Label>Preferred until</Label><Input type="time" value={waitlistTimeEnd} onChange={(e) => setWaitlistTimeEnd(e.target.value)} /></div>
                </div>
                <label className="flex items-start gap-2 text-[12px] text-muted-foreground">
                  <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} className="mt-0.5" />
                  <span>
                    {consentText || "I agree to receive appointment-related text messages."}
                  </span>
                </label>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {appointmentSmsConsentDisclosure(workspaceName)}{" "}
                  <a href={termsUrl} className="font-semibold text-primary">Terms</a> ·{" "}
                  <a href={privacyUrl} className="font-semibold text-primary">Privacy</a>
                </p>
                {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                <Button className="w-full" disabled={submitting} onClick={joinWaitlist}>{submitting ? "Joining…" : "Join waitlist"}</Button>
              </div>
            )}
          </Card>
        ) : null}

        {step === "info" ? (
          <Card className="p-5 sm:p-6">
            <button type="button" className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline" onClick={() => setStep("datetime")}>
              <ArrowLeft className="h-3.5 w-3.5" /> Change time
            </button>
            <div className="mb-5 flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <CalendarCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">{selectedType?.name}</p>
                <p className="text-[12px] text-muted-foreground">{selectedWhen}</p>
                {recurringMode !== "once" ? (
                  <p className="text-[12px] text-primary">Recurring: {recurringMode}, {recurringOccurrences} times</p>
                ) : null}
                {paymentLabel ? <p className="text-[12px] font-medium text-primary">{paymentLabel} due at checkout</p> : null}
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>First name *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
                <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
              </div>
              <div><Label>Mobile phone *</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="sr-only" aria-hidden><Input tabIndex={-1} value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              {activeQuestions.map((q) => (
                <BookingQuestionField key={q.id} question={q} value={bookingAnswers[q.id] || ""} onChange={(v) => setBookingAnswers((prev) => ({ ...prev, [q.id]: v }))} />
              ))}
              <div><Label>Notes (optional)</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-muted/30 px-3.5 py-3">
                <input type="checkbox" className="mt-0.5" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} />
                <span className="text-[12px] text-muted-foreground">
                  {consentText || "I agree to receive appointment-related text messages."}
                </span>
              </label>
              <p className="text-[11px] leading-relaxed text-muted-foreground px-1">
                {appointmentSmsConsentDisclosure(workspaceName)}{" "}
                <a href={termsUrl} className="font-semibold text-primary">Terms</a> ·{" "}
                <a href={privacyUrl} className="font-semibold text-primary">Privacy</a>
              </p>
              {challengeRequired ? (
                <label className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-3 text-[13px]">
                  <input type="checkbox" checked={humanVerification} onChange={(e) => setHumanVerification(e.target.checked)} />
                  <ShieldCheck className="h-4 w-4" /> I confirm I am a real person
                </label>
              ) : null}
              {bookingConflicts.length > 0 ? (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  Some recurring dates could not be booked:
                  <ul className="mt-1 list-disc pl-4">
                    {bookingConflicts.map((c) => (
                      <li key={c.startsAt}>{new Date(c.startsAt).toLocaleString()}: {c.reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p> : null}
              <Button size="lg" className="w-full" disabled={submitting || paymentPending} onClick={book}>
                {paymentPending ? "Redirecting to payment…" : paymentLabel ? `Continue to payment` : submitting ? "Booking…" : "Confirm booking"}
              </Button>
            </div>
          </Card>
        ) : null}

        {step === "payment" && squareConfig && pendingAppointmentId ? (
          <SquarePaymentStep
            slug={slug}
            appointmentId={pendingAppointmentId}
            square={squareConfig}
            onSuccess={() => setStep("done")}
            onCancel={() => setStep("info")}
          />
        ) : null}

        {step === "done" ? (
          <Card className="p-8 text-center sm:p-10">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="h-6 w-6" />
            </div>
            <h2 className="font-display text-xl font-semibold">You&apos;re booked!</h2>
            <p className="mt-2 text-sm font-medium">{selectedType?.name}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{selectedWhen}</p>
            {paymentLabel ? (
              <p className="mt-2 text-[12px] text-muted-foreground">
                {selectedType?.config?.payment?.mode === "deposit" ? "Deposit paid" : "Payment received"}
              </p>
            ) : null}
            <div className="mx-auto mt-6 max-w-xs rounded-xl bg-muted/50 px-4 py-3 text-[12px] text-muted-foreground">
              You&apos;ll receive a confirmation text shortly with options to reschedule or cancel.
            </div>
          </Card>
        ) : null}

        <p className="mt-8 text-center text-[11px] text-muted-foreground/70">Powered by your booking provider</p>
      </div>
    </div>
  );
}
