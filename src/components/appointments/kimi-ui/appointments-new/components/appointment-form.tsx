"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppointmentType, Slot } from "../types";
import { SlotPicker } from "./slot-picker";
import { SummarySidebar } from "./summary-sidebar";

function SectionHeading({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.1)] text-[11px] font-bold tabular-nums text-[hsl(var(--primary))]">
        {step}
      </span>
      <div>
        <h2 className="font-display text-sm font-semibold tracking-tight text-[hsl(var(--foreground))]">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function Label({
  htmlFor,
  children,
  optional,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[13px] font-semibold tracking-tight text-[hsl(var(--foreground)/0.9)]"
    >
      {children}
      {optional ? (
        <span className="ml-1.5 text-xs font-normal text-[hsl(var(--muted-foreground))]">— Optional</span>
      ) : null}
    </label>
  );
}

type View = "form" | "success" | "cancelled";

export function AppointmentForm({
  createdId,
  onCreated,
  onReset,
}: {
  createdId: string | null;
  onCreated: (id: string) => void;
  onReset: () => void;
}) {
  const [view, setView] = useState<View>("form");
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [linkedContact, setLinkedContact] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [detailNoticeOpen, setDetailNoticeOpen] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);
  const cancelDialogRef = useRef<HTMLDivElement>(null);

  const selectedType = types.find((t) => t.id === serviceId);

  const isDirty =
    !!startsAt ||
    !!firstName.trim() ||
    !!lastName.trim() ||
    !!phone.trim() ||
    !!email.trim() ||
    !!notes.trim() ||
    !!linkedContact;

  const [contacts, setContacts] = useState<
    Array<{ id: string; firstName: string; lastName: string; phone: string; email: string }>
  >([]);

  useEffect(() => {
    fetch("/api/appointments/types")
      .then((r) => r.json())
      .then((json) => {
        const list = json.data || [];
        setTypes(list);
        if (list[0]?.id) setServiceId(list[0].id);
      })
      .catch(() => {});
  }, []);

  // Availability fetch from /api/appointments/availability
  useEffect(() => {
    if (!selectedType) return;
    setLoadingSlots(true);
    setSlotError("");
    fetch(
      `/api/appointments/availability?serviceName=${encodeURIComponent(selectedType.name)}&daysAhead=14`,
    )
      .then((r) => r.json())
      .then((json) => setSlots(json.data?.slots || []))
      .catch(() => setSlotError("Could not load availability."))
      .finally(() => setLoadingSlots(false));
  }, [selectedType?.id, selectedType?.name]);

  useEffect(() => {
    const q = contactQuery.trim();
    if (!q) {
      setContacts([]);
      return;
    }
    fetch(`/api/contacts?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((json) => {
        setContacts(
          (json.data || []).map((c: { id: string; firstName?: string; lastName?: string; phone: string; email?: string }) => ({
            id: c.id,
            firstName: c.firstName || "",
            lastName: c.lastName || "",
            phone: c.phone,
            email: c.email || "",
          })),
        );
      })
      .catch(() => setContacts([]));
  }, [contactQuery]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setContactOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Focus + Escape handling for the discard-changes dialog
  useEffect(() => {
    if (!cancelConfirmOpen) return;
    const btn = cancelDialogRef.current?.querySelector<HTMLButtonElement>("[data-keep-editing]");
    btn?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCancelConfirmOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cancelConfirmOpen]);

  const filteredContacts = useMemo(() => contacts, [contacts]);

  function pickContact(id: string) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    setLinkedContact(id);
    setFirstName(c.firstName);
    setLastName(c.lastName);
    setPhone(c.phone);
    setEmail(c.email);
    setContactQuery(`${c.firstName} ${c.lastName}`);
    setContactOpen(false);
  }

  function clearContact() {
    setLinkedContact(null);
    setContactQuery("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!selectedType) errs.service = "Select an appointment type.";
    if (!startsAt) errs.slot = "Select an available time.";
    if (!firstName.trim()) errs.firstName = "Enter the customer's first name.";
    if (!phone.trim()) errs.phone = "Enter a mobile number for appointment updates.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a complete email address.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit() {
    setError("");
    if (!validate()) {
      setError("A few fields need attention before this appointment can be created.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: selectedType?.id,
        serviceName: selectedType?.name,
        startsAt,
        firstName,
        lastName,
        phone,
        email,
        notes,
        smsConsent,
        status: "scheduled",
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error || "Could not create appointment");
      return;
    }
    const id = json.data?.appointmentId || json.data?.id || "";
    setView("success");
    onCreated(id);
  }

  function bookAnother() {
    setView("form");
    onReset();
    setStartsAt("");
    clearContact();
    setNotes("");
    setSmsConsent(false);
    setError("");
    setFieldErrors({});
  }

  function handleCancel() {
    if (isDirty) {
      setCancelConfirmOpen(true);
    } else {
      setView("cancelled");
    }
  }

  function confirmDiscard() {
    setCancelConfirmOpen(false);
    setView("cancelled");
  }

  const summaryDate = startsAt
    ? new Date(startsAt).toLocaleString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  /* ---------------- Cancelled view (return destination for Cancel) ---------------- */
  if (view === "cancelled") {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <div className="surface tv-fade-in rounded-xl bg-[hsl(var(--card))] p-8 text-center">
          <h1 className="font-display text-xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
            Booking discarded
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            No appointment was created. In production this returns you to Appointments.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button type="button" onClick={bookAnother} className="tv-btn tv-btn-primary tv-btn-lg">
              <Plus className="h-4 w-4" />
              Start a new appointment
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- Success view ---------------- */
  if (view === "success" && createdId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <div className="surface tv-fade-in rounded-xl bg-[hsl(var(--card))] p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--success)/0.1)]">
            <CheckCircle2 className="h-6 w-6 text-[hsl(var(--success))]" />
          </span>
          <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
            Appointment created
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            {selectedType?.name} for {firstName} {lastName}
            {summaryDate ? (
              <>
                <br />
                <span className="font-medium text-[hsl(var(--foreground))]">{summaryDate}</span>
              </>
            ) : null}
          </p>
          {smsConsent && phone ? (
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              Confirmation and reminders will be sent to {phone}.
            </p>
          ) : null}
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setDetailNoticeOpen(true)}
              className="tv-btn tv-btn-primary tv-btn-lg"
            >
              View appointment
            </button>
            <button type="button" onClick={bookAnother} className="tv-btn tv-btn-outline tv-btn-lg">
              <Plus className="h-4 w-4" />
              Book another
            </button>
          </div>
        </div>

        {detailNoticeOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appt-detail-title"
            onClick={() => setDetailNoticeOpen(false)}
          >
            <div
              className="surface tv-fade-in w-full max-w-md rounded-xl bg-[hsl(var(--card))] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="appt-detail-title" className="font-display text-base font-semibold text-[hsl(var(--foreground))]">
                Appointment detail
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                In production this opens the full appointment at{" "}
                <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs text-[hsl(var(--foreground))]">
                  /appointments/{createdId}
                </code>{" "}
                with the communication timeline, reminder schedule, and actions (Message, Reschedule, Cancel).
              </p>
              <dl className="mt-4 space-y-2 rounded-[10px] border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[hsl(var(--muted-foreground))]">Customer</dt>
                  <dd className="font-medium text-[hsl(var(--foreground))]">{firstName} {lastName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[hsl(var(--muted-foreground))]">Type</dt>
                  <dd className="font-medium text-[hsl(var(--foreground))]">{selectedType?.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[hsl(var(--muted-foreground))]">When</dt>
                  <dd className="text-right font-medium text-[hsl(var(--foreground))]">{summaryDate}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[hsl(var(--muted-foreground))]">Status</dt>
                  <dd className="font-medium text-[hsl(var(--foreground))]">Scheduled</dd>
                </div>
              </dl>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDetailNoticeOpen(false)}
                  className="tv-btn tv-btn-primary tv-btn-md"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ---------------- Form view ---------------- */
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]" aria-label="Breadcrumb">
            <button
              type="button"
              onClick={handleCancel}
              className="font-medium transition-colors hover:text-[hsl(var(--foreground))]"
            >
              Appointments
            </button>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-[hsl(var(--foreground))]" aria-current="page">
              New
            </span>
          </nav>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
            New Appointment
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Book a customer manually from the admin calendar.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
          {/* Main form */}
          <div className="surface rounded-xl bg-[hsl(var(--card))] p-0">
            {/* Step 1: Service & time */}
            <div className="space-y-5 border-b border-[hsl(var(--border))] p-6">
              <SectionHeading
                step="1"
                title="Service & time"
                description="Choose an appointment type, then pick an open slot."
              />

              <div>
                <Label htmlFor="service">Appointment type</Label>
                <select
                  id="service"
                  value={serviceId}
                  onChange={(e) => {
                    setServiceId(e.target.value);
                    setStartsAt("");
                  }}
                  className="tv-input tv-select"
                  aria-invalid={!!fieldErrors.service}
                >
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} · {type.durationMinutes} min
                    </option>
                  ))}
                </select>
                {fieldErrors.service ? (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[hsl(var(--danger))]">
                    <AlertCircle className="h-3 w-3" /> {fieldErrors.service}
                  </p>
                ) : null}
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <Label>Available times</Label>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    Next 14 days · Eastern Time
                  </span>
                </div>
                <SlotPicker
                  slots={slots}
                  loading={loadingSlots}
                  selected={startsAt}
                  onSelect={(s) => {
                    setStartsAt(s);
                    setFieldErrors((p) => ({ ...p, slot: "" }));
                  }}
                  error={slotError}
                />
                {fieldErrors.slot ? (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[hsl(var(--danger))]">
                    <AlertCircle className="h-3 w-3" /> {fieldErrors.slot}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Step 2: Customer */}
            <div className="space-y-5 border-b border-[hsl(var(--border))] p-6">
              <SectionHeading
                step="2"
                title="Customer"
                description="Search an existing contact or enter a new customer."
              />

              <div ref={contactRef} className="relative">
                <Label htmlFor="contact-search" optional>
                  Link existing contact
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                  <input
                    id="contact-search"
                    value={contactQuery}
                    onChange={(e) => {
                      setContactQuery(e.target.value);
                      setContactOpen(true);
                      if (linkedContact) setLinkedContact(null);
                    }}
                    onFocus={() => setContactOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setContactOpen(false);
                    }}
                    placeholder="Search by name, phone, or email…"
                    className="tv-input pl-9 pr-9"
                    role="combobox"
                    aria-expanded={contactOpen}
                    aria-autocomplete="list"
                  />
                  {linkedContact ? (
                    <button
                      type="button"
                      onClick={clearContact}
                      aria-label="Clear linked contact"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                {contactOpen && filteredContacts.length > 0 ? (
                  <div
                    role="listbox"
                    className="surface absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl bg-[hsl(var(--card))]"
                  >
                    {filteredContacts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={linkedContact === c.id}
                        onClick={() => pickContact(c.id)}
                        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-[hsl(var(--muted)/0.6)]"
                      >
                        <span>
                          <span className="block text-[13px] font-semibold text-[hsl(var(--foreground))]">
                            {c.firstName} {c.lastName}
                          </span>
                          <span className="block text-xs text-[hsl(var(--muted-foreground))]">
                            {c.phone} · {c.email}
                          </span>
                        </span>
                        {linkedContact === c.id ? (
                          <Check className="h-4 w-4 text-[hsl(var(--primary))]" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                {contactOpen && filteredContacts.length === 0 ? (
                  <div className="surface absolute z-20 mt-1.5 w-full rounded-xl bg-[hsl(var(--card))] px-3.5 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                    No contacts match "{contactQuery}". Fill in the fields below to create one.
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">First name</Label>
                  <input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Sarah"
                    autoComplete="given-name"
                    className="tv-input"
                    aria-invalid={!!fieldErrors.firstName}
                  />
                  {fieldErrors.firstName ? (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[hsl(var(--danger))]">
                      <AlertCircle className="h-3 w-3" /> {fieldErrors.firstName}
                    </p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="lastName" optional>
                    Last name
                  </Label>
                  <input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Johnson"
                    autoComplete="family-name"
                    className="tv-input"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Mobile number</Label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(571) 555-0142"
                    autoComplete="tel"
                    className="tv-input"
                    aria-invalid={!!fieldErrors.phone}
                  />
                  {fieldErrors.phone ? (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[hsl(var(--danger))]">
                      <AlertCircle className="h-3 w-3" /> {fieldErrors.phone}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                      Used for confirmations and reminder texts.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="email" optional>
                    Email address
                  </Label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="tv-input"
                    aria-invalid={!!fieldErrors.email}
                  />
                  {fieldErrors.email ? (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[hsl(var(--danger))]">
                      <AlertCircle className="h-3 w-3" /> {fieldErrors.email}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Step 3: Details & communication */}
            <div className="space-y-5 p-6">
              <SectionHeading
                step="3"
                title="Details & communication"
                description="Internal notes and reminder consent for this appointment."
              />

              <div>
                <Label htmlFor="notes" optional>
                  Appointment notes
                </Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Gate code, parking instructions, preparation details…"
                  className="tv-input tv-textarea"
                />
                <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  Visible to staff only. Not sent to the customer.
                </p>
              </div>

              <div className="rounded-[10px] border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]"
                  />
                  <span>
                    <span className="block text-[13px] font-semibold text-[hsl(var(--foreground))]">
                      Customer agrees to receive appointment text messages
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                      The customer consents to SMS confirmations and reminders about this appointment from your
                      business. Message and data rates may apply. Reply STOP to opt out. Confirm verbal consent was
                      given before enabling.
                    </span>
                  </span>
                </label>
                {smsConsent ? (
                  <div className="mt-3 border-t border-[hsl(var(--border))] pt-3">
                    <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                      Reminder preview — Standard Reminders
                    </p>
                    <p className="mt-1.5 rounded-lg bg-[hsl(var(--card))] px-3 py-2 text-xs leading-relaxed text-[hsl(var(--foreground))] shadow-sm">
                      Hi {firstName || "{{first_name}}"}, this is a reminder of your {selectedType?.name || "appointment"}
                      {summaryDate ? ` on ${summaryDate}` : " on {{appointment_date}}"}. Reply YES to confirm or C to
                      cancel.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <SummarySidebar
            typeName={selectedType?.name}
            duration={selectedType?.durationMinutes}
            startsAt={startsAt || undefined}
            firstName={firstName}
            lastName={lastName}
            phone={phone}
            smsConsent={smsConsent}
          />
        </div>

        {/* Footer action bar */}
        <div className="surface sticky bottom-4 z-10 rounded-xl bg-[hsl(var(--card))] px-5 py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-[20px]">
              {error ? (
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-[hsl(var(--danger))]" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              ) : summaryDate ? (
                <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                  Booking <span className="font-semibold text-[hsl(var(--foreground))]">{summaryDate}</span>
                </p>
              ) : (
                <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                  Select a time slot to continue.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleCancel} className="tv-btn tv-btn-ghost tv-btn-md">
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving || !startsAt}
                className="tv-btn tv-btn-primary tv-btn-lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create appointment"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Discard-changes confirmation */}
      {cancelConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-title"
          onClick={() => setCancelConfirmOpen(false)}
        >
          <div
            ref={cancelDialogRef}
            className="surface tv-fade-in w-full max-w-sm rounded-xl bg-[hsl(var(--card))] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="discard-title" className="font-display text-base font-semibold text-[hsl(var(--foreground))]">
              Discard this appointment?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
              You have unsaved changes. Leaving now will discard the appointment details you've entered.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                data-keep-editing
                onClick={() => setCancelConfirmOpen(false)}
                className="tv-btn tv-btn-outline tv-btn-md"
              >
                Keep editing
              </button>
              <button type="button" onClick={confirmDiscard} className="tv-btn tv-btn-danger tv-btn-md">
                Discard changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
