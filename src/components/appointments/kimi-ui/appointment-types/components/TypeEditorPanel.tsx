"use client";

import { ChevronLeft, Info, GripVertical, MoreHorizontal, Check, Plus } from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";

interface Props {
  form: AppointmentTypeFormState;
  isCreating: boolean;
  saving: boolean;
  error: string;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onSave: () => void;
  onCancel: () => void;
  onBack: () => void;
  onManageAvailability: () => void;
}

export default function TypeEditorPanel({
  form,
  isCreating,
  saving,
  error,
  onFormChange,
  onSave,
  onCancel,
  onBack,
  onManageAvailability,
}: Props) {
  const questions = form.customQuestion.trim()
    ? [
        {
          id: "custom_question",
          label: form.customQuestion.trim(),
          type: "Short answer",
          required: form.customQuestionRequired,
        },
      ]
    : [];

  return (
    <div className="card flex-1 min-w-[440px] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#ecedf2]">
        <button
          type="button"
          className="flex items-center gap-1.5 text-[13px] text-[#6b6f82] hover:text-[#3f4254]"
          onClick={onBack}
        >
          <ChevronLeft size={15} /> Back to all types
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
        <section>
          <h3 className="text-[14px] font-semibold mb-4">Basic details</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label">Name</label>
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => onFormChange("name", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Duration</label>
              <div className="flex items-center gap-2">
                <input
                  className="input w-20"
                  type="number"
                  min={0}
                  value={form.durationMinutes}
                  onChange={(e) => onFormChange("durationMinutes", Number(e.target.value) || 0)}
                />
                <span className="text-[12.5px] text-[#8a8fa3]">min</span>
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-1">
                Buffer time <Info size={12} className="text-[#a0a3b5]" />
              </label>
              <div className="flex items-center gap-2">
                <input
                  className="input w-20"
                  type="number"
                  min={0}
                  value={form.bufferMinutes}
                  onChange={(e) => onFormChange("bufferMinutes", Number(e.target.value) || 0)}
                />
                <span className="text-[12.5px] text-[#8a8fa3]">min</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Location</label>
              <input
                className="input w-full"
                value={form.location}
                onChange={(e) => onFormChange("location", e.target.value)}
                placeholder="In-office, video call, phone…"
              />
            </div>
            <div>
              <label className="label">Price (optional)</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] text-[#8a8fa3]">$</span>
                  <input
                    className="input w-20"
                    value={form.priceDisplay.replace(/^\$/, "")}
                    placeholder="0"
                    onChange={(e) => onFormChange("priceDisplay", e.target.value ? `$${e.target.value.replace(/^\$/, "")}` : "")}
                  />
                </div>
                <label className="flex items-center gap-2 text-[12.5px] text-[#3f4254] cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={form.showPriceOnBooking}
                    onChange={(e) => onFormChange("showPriceOnBooking", e.target.checked)}
                  />
                  Show price on booking page
                </label>
              </div>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <div className="relative">
              <textarea
                className="input w-full resize-none"
                rows={4}
                value={form.description}
                onChange={(e) => onFormChange("description", e.target.value)}
              />
              <span className="absolute bottom-2.5 right-3 text-[11px] text-[#a0a3b5]">
                {form.description.length}/500
              </span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[14px] font-semibold">Availability rules</h3>
          <p className="text-[12.5px] text-[#8a8fa3] mb-4">Control when this type can be booked.</p>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <label className="label">Availability hours</label>
              <input
                className="input w-full"
                value={form.bookingHours}
                onChange={(e) => onFormChange("bookingHours", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Min notice</label>
              <div className="flex items-center gap-2">
                <input
                  className="input w-20"
                  type="number"
                  min={0}
                  value={form.minimumBookingNoticeMinutes}
                  onChange={(e) =>
                    onFormChange("minimumBookingNoticeMinutes", Number(e.target.value) || 0)
                  }
                />
                <span className="text-[12.5px] text-[#8a8fa3]">min</span>
              </div>
            </div>
            <div>
              <label className="label">Max days ahead</label>
              <div className="flex items-center gap-2">
                <input
                  className="input w-20"
                  type="number"
                  min={1}
                  value={form.maximumBookingDaysAhead}
                  onChange={(e) =>
                    onFormChange("maximumBookingDaysAhead", Number(e.target.value) || 1)
                  }
                />
                <span className="text-[12.5px] text-[#8a8fa3]">days</span>
              </div>
            </div>
          </div>
          <div className="flex items-start justify-between gap-4">
            <label className="flex items-center gap-2 text-[12.5px] text-[#3f4254] cursor-pointer">
              <input
                type="checkbox"
                className="checkbox"
                checked={form.enabled}
                onChange={(e) => onFormChange("enabled", e.target.checked)}
              />
              Active on booking page
            </label>
            <div className="bg-[#f7f8fb] border border-[#ecedf2] rounded-xl p-3.5 w-[230px] shrink-0">
              <p className="text-[12px] font-semibold mb-1">Applies to</p>
              <p className="text-[11.5px] text-[#8a8fa3] leading-snug mb-2">
                These rules apply to any calendar connected to this appointment type.
              </p>
              <button
                type="button"
                className="text-[12px] font-medium text-[#5b4bff] hover:underline flex items-center gap-1"
                onClick={onManageAvailability}
              >
                Manage availability →
              </button>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[14px] font-semibold">Booking form (questions shown to customers)</h3>
          </div>
          <p className="text-[12.5px] text-[#8a8fa3] mb-3">Collect the right information before the appointment.</p>
          <div className="mb-3">
            <label className="label">Custom question (optional)</label>
            <input
              className="input w-full"
              value={form.customQuestion}
              onChange={(e) => onFormChange("customQuestion", e.target.value)}
              placeholder="e.g. What brings you in today?"
            />
          </div>
          {form.customQuestion.trim() ? (
            <label className="flex items-center gap-2 text-[12.5px] text-[#3f4254] cursor-pointer mb-3">
              <input
                type="checkbox"
                className="checkbox"
                checked={form.customQuestionRequired}
                onChange={(e) => onFormChange("customQuestionRequired", e.target.checked)}
              />
              Require an answer on the booking form
            </label>
          ) : null}
          {questions.length > 0 ? (
            <div className="border border-[#ecedf2] rounded-xl overflow-hidden">
              <div className="grid grid-cols-[24px_1fr_130px_70px_32px] gap-2 px-4 py-2.5 bg-[#f7f8fb] text-[11px] font-semibold text-[#8a8fa3] uppercase tracking-wide">
                <span />
                <span>Question</span>
                <span>Type</span>
                <span>Required</span>
                <span />
              </div>
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="grid grid-cols-[24px_1fr_130px_70px_32px] gap-2 px-4 py-3 border-t border-[#ecedf2] items-center"
                >
                  <GripVertical size={14} className="text-[#c6c9d6]" />
                  <span className="text-[13px] font-medium">{q.label}</span>
                  <span className="text-[12.5px] text-[#8a8fa3]">{q.type}</span>
                  <span className="flex justify-center">
                    {q.required ? (
                      <Check size={15} className="text-emerald-500" />
                    ) : (
                      <span className="text-[#c6c9d6]">—</span>
                    )}
                  </span>
                  <MoreHorizontal size={15} className="text-[#a0a3b5]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#ecedf2] px-4 py-6 text-center text-[12.5px] text-[#8a8fa3]">
              No custom questions yet.
            </div>
          )}
        </section>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700 ring-1 ring-inset ring-rose-600/15">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#ecedf2] bg-white">
        <button
          type="button"
          className="text-[13px] font-medium px-4 py-2 rounded-lg border border-[#e4e6ee] hover:bg-[#f7f8fb]"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-brand text-[13px] font-semibold px-5 py-2 rounded-lg disabled:opacity-60"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving…" : isCreating ? "Create type" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
