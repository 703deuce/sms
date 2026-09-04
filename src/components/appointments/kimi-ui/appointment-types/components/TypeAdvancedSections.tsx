"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { CancellationPolicy, ReschedulePolicy } from "@/lib/appointments/types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import {
  newBookingQuestion,
  QUESTION_TYPE_OPTIONS,
  STAFF_ASSIGNMENT_OPTIONS,
} from "@/features/appointments/kimi/shared/platform-settings-types";

type Props = {
  form: AppointmentTypeFormState;
  staffOptions: Array<{ id: string; name: string }>;
  locationOptions: Array<{ id: string; name: string }>;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
};

export default function TypeAdvancedSections({
  form,
  staffOptions,
  locationOptions,
  onFormChange,
}: Props) {
  const questions = form.bookingQuestions;

  function updateQuestion(index: number, patch: Partial<typeof questions[number]>) {
    const next = questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
    onFormChange("bookingQuestions", next);
  }

  function removeQuestion(index: number) {
    onFormChange("bookingQuestions", questions.filter((_, i) => i !== index));
  }

  function toggleStaffId(id: string, listKey: "staffIds" | "collectiveStaffIds") {
    const current = form[listKey];
    onFormChange(
      listKey,
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  function toggleLocationId(id: string) {
    const current = form.locationIds;
    onFormChange(
      "locationIds",
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  const showStaffPool =
    form.staffAssignment === "round_robin" ||
    form.staffAssignment === "maximize_availability" ||
    form.staffAssignment === "specific_staff" ||
    form.staffAssignment === "customer_chooses";

  const showCollective = form.staffAssignment === "collective";

  return (
    <>
      {/* Staff assignment */}
      <section>
        <h3 className="text-[14px] font-semibold mb-1">Staff assignment</h3>
        <p className="text-[12.5px] text-[#8a8fa3] mb-4">How customers are matched with team members.</p>
        <div className="grid gap-2 mb-4">
          {STAFF_ASSIGNMENT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${
                form.staffAssignment === opt.value
                  ? "border-[#5b4bff] bg-[#f7f6ff]"
                  : "border-[#ecedf2]"
              }`}
            >
              <input
                type="radio"
                name="staffAssignment"
                checked={form.staffAssignment === opt.value}
                onChange={() => onFormChange("staffAssignment", opt.value)}
                className="mt-0.5"
              />
              <div>
                <p className="text-[13px] font-medium">{opt.label}</p>
                <p className="text-[12px] text-[#8a8fa3]">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
        {(showStaffPool || showCollective) && staffOptions.length > 0 ? (
          <div className="rounded-xl border border-[#ecedf2] p-4">
            <p className="text-[12px] font-semibold mb-2">
              {showCollective ? "Required staff (all must be available)" : "Eligible staff pool"}
            </p>
            <div className="flex flex-wrap gap-2">
              {staffOptions.map((s) => {
                const selected = showCollective
                  ? form.collectiveStaffIds.includes(s.id)
                  : form.staffIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`rounded-full px-3 py-1 text-[12px] font-medium border ${
                      selected
                        ? "bg-[#5b4bff] text-white border-[#5b4bff]"
                        : "bg-white text-[#3f4254] border-[#e4e6ee]"
                    }`}
                    onClick={() =>
                      toggleStaffId(s.id, showCollective ? "collectiveStaffIds" : "staffIds")
                    }
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (showStaffPool || showCollective) ? (
          <p className="text-[12px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            Add bookable staff under Team → Staff to configure assignment.
          </p>
        ) : null}
      </section>

      {/* Locations */}
      {locationOptions.length > 0 ? (
        <section>
          <h3 className="text-[14px] font-semibold mb-1">Locations</h3>
          <p className="text-[12.5px] text-[#8a8fa3] mb-3">Limit this type to specific locations, or leave all unselected for any location.</p>
          <div className="flex flex-wrap gap-2">
            {locationOptions.map((loc) => (
              <button
                key={loc.id}
                type="button"
                className={`rounded-full px-3 py-1 text-[12px] font-medium border ${
                  form.locationIds.includes(loc.id)
                    ? "bg-[#5b4bff] text-white border-[#5b4bff]"
                    : "bg-white text-[#3f4254] border-[#e4e6ee]"
                }`}
                onClick={() => toggleLocationId(loc.id)}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Booking questions */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[14px] font-semibold">Booking questions</h3>
          <button
            type="button"
            className="text-[12px] font-medium text-[#5b4bff] flex items-center gap-1"
            onClick={() => onFormChange("bookingQuestions", [...questions, newBookingQuestion()])}
          >
            <Plus size={14} /> Add question
          </button>
        </div>
        <p className="text-[12.5px] text-[#8a8fa3] mb-3">Shown on the public booking form and collected by AI booking.</p>
        {questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#ecedf2] px-4 py-6 text-center text-[12.5px] text-[#8a8fa3]">
            No custom questions yet.
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, index) => (
              <div key={q.id} className="rounded-xl border border-[#ecedf2] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-[#c6c9d6] shrink-0" />
                  <input
                    className="input flex-1"
                    placeholder="Question label"
                    value={q.label}
                    onChange={(e) => updateQuestion(index, { label: e.target.value })}
                  />
                  <select
                    className="input w-36"
                    value={q.type}
                    onChange={(e) => updateQuestion(index, { type: e.target.value as typeof q.type })}
                  >
                    {QUESTION_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeQuestion(index)} className="text-[#a0a3b5] hover:text-rose-600">
                    <Trash2 size={15} />
                  </button>
                </div>
                <input
                  className="input w-full text-[12px]"
                  placeholder="Help text (optional)"
                  value={q.description || ""}
                  onChange={(e) => updateQuestion(index, { description: e.target.value })}
                />
                {["select", "radio", "multiselect"].includes(q.type) ? (
                  <input
                    className="input w-full text-[12px]"
                    placeholder="Options (comma-separated)"
                    value={(q.options || []).join(", ")}
                    onChange={(e) =>
                      updateQuestion(index, {
                        options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                ) : null}
                <label className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={q.required}
                    onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                  />
                  Required
                </label>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Policies */}
      <section>
        <h3 className="text-[14px] font-semibold mb-4">Cancellation & rescheduling</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-[12px] font-semibold text-[#6b6f82]">Cancellation</p>
            <select
              className="input w-full"
              value={form.cancellationPolicy.allowed}
              onChange={(e) =>
                onFormChange("cancellationPolicy", {
                  ...form.cancellationPolicy,
                  allowed: e.target.value as CancellationPolicy["allowed"],
                })
              }
            >
              <option value="anytime">Anytime</option>
              <option value="until_hours_before">Until X hours before</option>
              <option value="disabled">Disabled</option>
            </select>
            {form.cancellationPolicy.allowed === "until_hours_before" ? (
              <input
                className="input w-24"
                type="number"
                min={1}
                value={form.cancellationPolicy.cutoffHours || 24}
                onChange={(e) =>
                  onFormChange("cancellationPolicy", {
                    ...form.cancellationPolicy,
                    cutoffHours: Number(e.target.value) || 24,
                  })
                }
              />
            ) : null}
            <textarea
              className="input w-full resize-none text-[12px]"
              rows={2}
              placeholder="Customer-facing policy text"
              value={form.cancellationPolicy.policyText || ""}
              onChange={(e) =>
                onFormChange("cancellationPolicy", {
                  ...form.cancellationPolicy,
                  policyText: e.target.value,
                })
              }
            />
          </div>
          <div className="space-y-3">
            <p className="text-[12px] font-semibold text-[#6b6f82]">Rescheduling</p>
            <select
              className="input w-full"
              value={form.reschedulePolicy.allowed}
              onChange={(e) =>
                onFormChange("reschedulePolicy", {
                  ...form.reschedulePolicy,
                  allowed: e.target.value as ReschedulePolicy["allowed"],
                })
              }
            >
              <option value="anytime">Anytime</option>
              <option value="until_hours_before">Until X hours before</option>
              <option value="disabled">Disabled</option>
            </select>
            {form.reschedulePolicy.allowed === "until_hours_before" ? (
              <input
                className="input w-24"
                type="number"
                min={1}
                value={form.reschedulePolicy.cutoffHours || 24}
                onChange={(e) =>
                  onFormChange("reschedulePolicy", {
                    ...form.reschedulePolicy,
                    cutoffHours: Number(e.target.value) || 24,
                  })
                }
              />
            ) : null}
            <textarea
              className="input w-full resize-none text-[12px]"
              rows={2}
              placeholder="Customer-facing policy text"
              value={form.reschedulePolicy.policyText || ""}
              onChange={(e) =>
                onFormChange("reschedulePolicy", {
                  ...form.reschedulePolicy,
                  policyText: e.target.value,
                })
              }
            />
          </div>
        </div>
      </section>

      {/* Payment */}
      <section>
        <h3 className="text-[14px] font-semibold mb-4">Payment</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Requirement</label>
            <select
              className="input w-full"
              value={form.paymentMode}
              onChange={(e) => onFormChange("paymentMode", e.target.value as typeof form.paymentMode)}
            >
              <option value="none">No payment</option>
              <option value="deposit">Deposit required</option>
              <option value="full">Full payment required</option>
            </select>
          </div>
          {form.paymentMode !== "none" ? (
            <>
              <div>
                <label className="label">Price (cents)</label>
                <input
                  className="input w-full"
                  type="number"
                  min={50}
                  value={form.paymentPriceCents}
                  onChange={(e) => onFormChange("paymentPriceCents", Number(e.target.value) || 0)}
                />
              </div>
              {form.paymentMode === "deposit" ? (
                <div>
                  <label className="label">Deposit (cents)</label>
                  <input
                    className="input w-full"
                    type="number"
                    min={50}
                    value={form.paymentDepositCents}
                    onChange={(e) => onFormChange("paymentDepositCents", Number(e.target.value) || 0)}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      {/* Group & recurring */}
      <section>
        <h3 className="text-[14px] font-semibold mb-4">Group & recurring</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="checkbox"
              checked={form.groupBookingEnabled}
              onChange={(e) => onFormChange("groupBookingEnabled", e.target.checked)}
            />
            Group appointment (multiple attendees per slot)
          </label>
          {form.groupBookingEnabled ? (
            <div className="flex items-center gap-2">
              <label className="label mb-0">Max attendees</label>
              <input
                className="input w-20"
                type="number"
                min={2}
                value={form.groupCapacity}
                onChange={(e) => onFormChange("groupCapacity", Number(e.target.value) || 2)}
              />
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="checkbox"
              checked={form.recurringEnabled}
              onChange={(e) => onFormChange("recurringEnabled", e.target.checked)}
            />
            Allow recurring bookings
          </label>
        </div>
      </section>

      {/* Booking limits */}
      <section>
        <h3 className="text-[14px] font-semibold mb-4">Booking limits</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Max per day (workspace)</label>
            <input
              className="input w-full"
              type="number"
              min={0}
              placeholder="No limit"
              value={form.maxBookingsPerDay ?? ""}
              onChange={(e) =>
                onFormChange("maxBookingsPerDay", e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>
          <div>
            <label className="label">Max per week (workspace)</label>
            <input
              className="input w-full"
              type="number"
              min={0}
              placeholder="No limit"
              value={form.maxBookingsPerWeek ?? ""}
              onChange={(e) =>
                onFormChange("maxBookingsPerWeek", e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>
          <div>
            <label className="label">Max this type / day</label>
            <input
              className="input w-full"
              type="number"
              min={0}
              placeholder="No limit"
              value={form.maxPerTypePerDay ?? ""}
              onChange={(e) =>
                onFormChange("maxPerTypePerDay", e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>
        </div>
      </section>
    </>
  );
}
