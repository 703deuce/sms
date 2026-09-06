"use client";

import { useState } from "react";
import { ChevronDown, Info, CreditCard, Users, CalendarClock, HelpCircle, Loader2 } from "lucide-react";
import type { AppointmentTypeFormState } from "../mock-data";

type Option = { id: string; name: string };

type Props = {
  form: AppointmentTypeFormState;
  isCreating: boolean;
  saving: boolean;
  error: string;
  dirty: boolean;
  staffOptions: Option[];
  locationOptions: Option[];
  connectedPaymentProviders: Array<{ provider: "stripe" | "square"; label: string }>;
  namedScheduleOptions: Option[];
  teamGroupOptions: Option[];
  onFormChange: <K extends keyof AppointmentTypeFormState>(key: K, value: AppointmentTypeFormState[K]) => void;
  onSave: () => void;
  onCancel: () => void;
};

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

function Section({
  icon,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#ecedf2] rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#f7f8fb] transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef0fd] text-[#4f46e5] shrink-0">
          {icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13.5px] font-semibold text-[#1a1d29]">{title}</span>
          <span className="block text-[12px] text-[#8a8fa3] mt-0.5">{description}</span>
        </span>
        <ChevronDown
          size={15}
          className={`text-[#a7abb9] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="px-4 pb-4 pt-1 border-t border-[#ecedf2] animate-in">{children}</div> : null}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[#3c4257]">{label}</div>
        {hint ? <div className="text-[12px] text-[#8a8fa3] mt-0.5">{hint}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="toggle"
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

export default function TypeEditorPanel({
  form,
  isCreating,
  saving,
  error,
  dirty,
  staffOptions,
  locationOptions,
  connectedPaymentProviders,
  namedScheduleOptions,
  teamGroupOptions,
  onFormChange,
  onSave,
  onCancel,
}: Props) {
  return (
    <div className="panel animate-in">
      {/* Editor header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#ecedf2]">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[#1a1d29]">
            {isCreating ? "New booking type" : form.name || "Edit booking type"}
          </h2>
          <p className="text-[12.5px] text-[#8a8fa3] mt-0.5">
            {isCreating
              ? "Configure how customers book this service."
              : dirty
                ? "You have unsaved changes."
                : "All changes saved."}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {!isCreating && (
            <button type="button" className="btn-secondary h-8.5 px-3.5 rounded-lg text-[13px] font-medium" onClick={onCancel}>
              Discard
            </button>
          )}
          <button
            type="button"
            className="btn-brand flex items-center gap-1.5 h-8.5 px-4 rounded-lg text-[13px] font-semibold shadow-sm transition-all active:scale-[0.98]"
            onClick={onSave}
            disabled={saving || (!dirty && !isCreating)}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isCreating ? "Create booking type" : "Save changes"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mx-5 mt-4 flex items-start gap-2.5 rounded-lg border border-[#fecdca] bg-[#fffbfa] px-3.5 py-3" role="alert">
          <Info size={15} className="text-[#d92d20] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[#b42318]">{error}</p>
        </div>
      ) : null}

      <div className="px-5 py-5 space-y-4">
        {/* Basics */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_110px] gap-4">
          <div>
            <label className="field-label" htmlFor="bt-name">
              Name <span className="text-[#d92d20]">*</span>
            </label>
            <input
              id="bt-name"
              className="field-input"
              placeholder="e.g. New Patient Exam"
              value={form.name}
              onChange={(e) => onFormChange("name", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="bt-duration">
              Duration
            </label>
            <select
              id="bt-duration"
              className="field-input"
              value={form.durationMinutes}
              onChange={(e) => onFormChange("durationMinutes", Number(e.target.value))}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="bt-buffer">
              Buffer
            </label>
            <select
              id="bt-buffer"
              className="field-input"
              value={form.bufferMinutes}
              onChange={(e) => onFormChange("bufferMinutes", Number(e.target.value))}
            >
              {[0, 5, 10, 15, 30].map((b) => (
                <option key={b} value={b}>
                  {b === 0 ? "None" : `${b} min`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="bt-desc">
            Description
          </label>
          <textarea
            id="bt-desc"
            className="field-input"
            rows={3}
            placeholder="Shown to customers on your booking page."
            value={form.description}
            onChange={(e) => onFormChange("description", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="bt-location">
              Location
            </label>
            <select
              id="bt-location"
              className="field-input"
              value={form.location}
              onChange={(e) => onFormChange("location", e.target.value)}
            >
              <option value="">Select a location</option>
              {locationOptions.map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="bt-schedule">
              Availability schedule
            </label>
            <select
              id="bt-schedule"
              className="field-input"
              value={form.namedScheduleId}
              onChange={(e) => onFormChange("namedScheduleId", e.target.value)}
            >
              {namedScheduleOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="field-hint">Using Standard Hours · Mon–Fri 9:00 AM – 5:00 PM ET</p>
          </div>
        </div>

        <hr className="section-divider" />

        {/* Progressive disclosure sections */}
        <div className="space-y-3">
          <Section
            icon={<Users size={15} />}
            title="Hosts & staff"
            description="Who can be booked for this service."
            defaultOpen
          >
            <div className="pt-3 space-y-3">
              <div>
                <label className="field-label" htmlFor="bt-staffmode">
                  Assignment
                </label>
                <select
                  id="bt-staffmode"
                  className="field-input"
                  value={form.staffAssignment}
                  onChange={(e) => onFormChange("staffAssignment", e.target.value as AppointmentTypeFormState["staffAssignment"])}
                >
                  <option value="any_eligible">Any eligible staff member</option>
                  <option value="specific">Specific staff</option>
                  <option value="round_robin">Round robin</option>
                  <option value="collective">Collective (all hosts required)</option>
                </select>
              </div>
              {form.staffAssignment !== "any_eligible" ? (
                <div className="space-y-1.5 animate-in">
                  {staffOptions.map((s) => {
                    const checked = form.staffIds.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2.5 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[#d8dbe6] accent-[#4f46e5]"
                          checked={checked}
                          onChange={() =>
                            onFormChange(
                              "staffIds",
                              checked ? form.staffIds.filter((id) => id !== s.id) : [...form.staffIds, s.id],
                            )
                          }
                        />
                        <span className="text-[13px] text-[#3c4257]">{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12.5px] text-[#8a8fa3]">
                  Customers can book with {staffOptions.map((s) => s.name.split(" ")[0]).join(", ")}.
                </p>
              )}
            </div>
          </Section>

          <Section
            icon={<CalendarClock size={15} />}
            title="Booking rules"
            description="Notice periods, limits, and cancellation policy."
          >
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label" htmlFor="bt-notice">
                  Minimum notice
                </label>
                <select
                  id="bt-notice"
                  className="field-input"
                  value={form.minimumBookingNoticeMinutes}
                  onChange={(e) => onFormChange("minimumBookingNoticeMinutes", Number(e.target.value))}
                >
                  <option value={0}>None</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={240}>4 hours</option>
                  <option value={1440}>1 day</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="bt-horizon">
                  Book up to
                </label>
                <select
                  id="bt-horizon"
                  className="field-input"
                  value={form.maximumBookingDaysAhead}
                  onChange={(e) => onFormChange("maximumBookingDaysAhead", Number(e.target.value))}
                >
                  <option value={7}>7 days ahead</option>
                  <option value={14}>14 days ahead</option>
                  <option value={30}>30 days ahead</option>
                  <option value={60}>60 days ahead</option>
                  <option value={90}>90 days ahead</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="bt-cancel">
                  Customer cancellation
                </label>
                <select
                  id="bt-cancel"
                  className="field-input"
                  value={form.cancellationPolicy}
                  onChange={(e) => onFormChange("cancellationPolicy", e.target.value as AppointmentTypeFormState["cancellationPolicy"])}
                >
                  <option value="anytime">Allowed anytime</option>
                  <option value="notice_required">Allowed with 24h notice</option>
                  <option value="not_allowed">Not allowed</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="bt-reschedule">
                  Customer rescheduling
                </label>
                <select
                  id="bt-reschedule"
                  className="field-input"
                  value={form.reschedulePolicy}
                  onChange={(e) => onFormChange("reschedulePolicy", e.target.value as AppointmentTypeFormState["reschedulePolicy"])}
                >
                  <option value="anytime">Allowed anytime</option>
                  <option value="notice_required">Allowed with 24h notice</option>
                  <option value="not_allowed">Not allowed</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <ToggleRow
                  label="Require booking approval"
                  hint="New bookings stay pending until your team confirms them."
                  checked={form.bookingApprovalRequired}
                  onChange={(v) => onFormChange("bookingApprovalRequired", v)}
                />
              </div>
            </div>
          </Section>

          <Section
            icon={<CreditCard size={15} />}
            title="Payment"
            description="Collect a payment or deposit when customers book."
          >
            <div className="pt-3 space-y-4">
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment requirement">
                {(
                  [
                    { v: "none", label: "Free" },
                    { v: "deposit", label: "Deposit" },
                    { v: "full", label: "Full payment" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    role="radio"
                    aria-checked={form.paymentMode === opt.v}
                    className={`h-9 rounded-lg border text-[13px] font-medium transition-colors ${
                      form.paymentMode === opt.v
                        ? "border-[#4f46e5] bg-[#eef0fd] text-[#4f46e5]"
                        : "border-[#e4e6ee] bg-white text-[#3c4257] hover:bg-[#f7f8fb]"
                    }`}
                    onClick={() => onFormChange("paymentMode", opt.v)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.paymentMode !== "none" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in">
                  <div>
                    <label className="field-label" htmlFor="bt-price">
                      Amount (USD)
                    </label>
                    <input
                      id="bt-price"
                      className="field-input"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.paymentPriceCents ? (form.paymentPriceCents / 100).toString() : ""}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
                        onFormChange("paymentPriceCents", Number.isFinite(n) ? Math.round(n * 100) : 0);
                      }}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="bt-provider">
                      Provider
                    </label>
                    <select
                      id="bt-provider"
                      className="field-input"
                      value={form.paymentProvider}
                      onChange={(e) => onFormChange("paymentProvider", e.target.value as AppointmentTypeFormState["paymentProvider"])}
                    >
                      <option value="">Select provider</option>
                      {connectedPaymentProviders.map((p) => (
                        <option key={p.provider} value={p.provider}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {connectedPaymentProviders.length === 0 ? (
                      <p className="field-hint">Connect Stripe or Square under Integrations → Payments.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </Section>

          <Section
            icon={<HelpCircle size={15} />}
            title="Customer questions"
            description="Ask customers for details when they book."
          >
            <div className="pt-3">
              <p className="text-[12.5px] text-[#8a8fa3]">
                Name, phone, and email are always collected. Add custom questions for this service.
              </p>
              <button type="button" className="btn-secondary mt-3 h-8.5 px-3.5 rounded-lg text-[13px] font-medium">
                Add question
              </button>
            </div>
          </Section>
        </div>

        {/* Danger zone */}
        {!isCreating ? (
          <div className="mt-6 rounded-xl border border-[#fecdca] px-4 py-3.5">
            <div className="text-[13px] font-semibold text-[#b42318]">Danger zone</div>
            <p className="text-[12.5px] text-[#8a8fa3] mt-1">
              Deleting this booking type stops new bookings. Existing appointments remain on your calendar.
            </p>
            <button
              type="button"
              className="mt-3 h-8.5 px-3.5 rounded-lg border border-[#fecdca] bg-white text-[13px] font-medium text-[#d92d20] hover:bg-[#fffbfa] transition-colors"
            >
              Delete booking type
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
