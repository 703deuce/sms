"use client";

import { Plus, Trash2 } from "lucide-react";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";

type Props = {
  form: AppointmentTypeFormState;
  namedScheduleOptions?: Array<{ id: string; name: string }>;
  teamGroupOptions?: Array<{ id: string; name: string }>;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
};

export default function TypePublishingSections({
  form,
  namedScheduleOptions = [],
  teamGroupOptions = [],
  onFormChange,
}: Props) {
  function addDurationOption() {
    const id = `dur_${Date.now()}`;
    onFormChange("durationOptions", [
      ...form.durationOptions,
      { id, label: `${form.durationMinutes + 15} min`, minutes: form.durationMinutes + 15, active: true },
    ]);
  }

  return (
    <>
      <section>
        <h3 className="text-[14px] font-semibold mb-1">Visibility & access</h3>
        <p className="text-[12.5px] text-[#8a8fa3] mb-3">
          Control who can see and book this appointment type.
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(["public", "unlisted", "secret"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`rounded-xl border px-3 py-2 text-[12px] font-medium capitalize ${
                form.visibility === v
                  ? "border-[#5b4bff] bg-[#f7f6ff] text-[#5b4bff]"
                  : "border-[#ecedf2]"
              }`}
              onClick={() => onFormChange("visibility", v)}
            >
              {v}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[12.5px]">
          <input
            type="checkbox"
            checked={form.managed}
            onChange={(e) => onFormChange("managed", e.target.checked)}
          />
          Managed event type (admin-controlled, org policy enforced)
        </label>
      </section>

      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[14px] font-semibold">Duration options</h3>
          <button
            type="button"
            className="text-[12px] font-medium text-[#5b4bff] flex items-center gap-1"
            onClick={addDurationOption}
          >
            <Plus size={14} /> Add duration
          </button>
        </div>
        <p className="text-[12.5px] text-[#8a8fa3] mb-3">
          Offer multiple lengths on one booking page. Primary duration is used when only one is shown.
        </p>
        {form.durationOptions.length === 0 ? (
          <p className="text-[12px] text-[#8a8fa3] rounded-lg border border-dashed border-[#ecedf2] px-3 py-4 text-center">
            Single duration ({form.durationMinutes} min) — add options to let customers choose.
          </p>
        ) : (
          <div className="space-y-2">
            {form.durationOptions.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  value={opt.label}
                  onChange={(e) => {
                    const next = [...form.durationOptions];
                    next[i] = { ...opt, label: e.target.value };
                    onFormChange("durationOptions", next);
                  }}
                />
                <input
                  className="input w-20"
                  type="number"
                  min={5}
                  value={opt.minutes}
                  onChange={(e) => {
                    const next = [...form.durationOptions];
                    next[i] = { ...opt, minutes: Number(e.target.value) || 30 };
                    onFormChange("durationOptions", next);
                  }}
                />
                <span className="text-[12px] text-[#8a8fa3]">min</span>
                <button
                  type="button"
                  onClick={() =>
                    onFormChange(
                      "durationOptions",
                      form.durationOptions.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 size={14} className="text-[#a0a3b5]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-[14px] font-semibold mb-3">Booking approval</h3>
        <label className="flex items-center gap-2 text-[12.5px] mb-2">
          <input
            type="checkbox"
            checked={form.bookingApprovalRequired}
            onChange={(e) => onFormChange("bookingApprovalRequired", e.target.checked)}
          />
          Require staff approval before confirming bookings
        </label>
        <p className="text-[12px] text-[#8a8fa3]">
          Customers receive a pending state until approved in the appointments queue.
        </p>
      </section>

      <section>
        <h3 className="text-[14px] font-semibold mb-3">After booking</h3>
        <label className="flex items-center gap-2 text-[12.5px] mb-3">
          <input
            type="checkbox"
            checked={form.redirectAfterBookingEnabled}
            onChange={(e) => onFormChange("redirectAfterBookingEnabled", e.target.checked)}
          />
          Redirect customer after successful booking
        </label>
        {form.redirectAfterBookingEnabled ? (
          <div className="space-y-2">
            <input
              className="input w-full"
              placeholder="https://yoursite.com/thank-you"
              value={form.redirectAfterBookingUrl}
              onChange={(e) => onFormChange("redirectAfterBookingUrl", e.target.value)}
            />
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={form.redirectIncludeQueryParams}
                onChange={(e) => onFormChange("redirectIncludeQueryParams", e.target.checked)}
              />
              Include UTM and appointment ID in redirect URL
            </label>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="text-[14px] font-semibold mb-3">Confirmation page</h3>
        <div className="space-y-3">
          <input
            className="input w-full"
            placeholder="Headline (optional)"
            value={form.confirmationHeadline}
            onChange={(e) => onFormChange("confirmationHeadline", e.target.value)}
          />
          <textarea
            className="input w-full resize-none"
            rows={3}
            placeholder="Custom confirmation message (HTML allowed)"
            value={form.confirmationBodyHtml}
            onChange={(e) => onFormChange("confirmationBodyHtml", e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="CTA label"
              value={form.confirmationCtaLabel}
              onChange={(e) => onFormChange("confirmationCtaLabel", e.target.value)}
            />
            <input
              className="input"
              placeholder="CTA URL"
              value={form.confirmationCtaUrl}
              onChange={(e) => onFormChange("confirmationCtaUrl", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[14px] font-semibold mb-3">Booking limits</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Max per month</label>
            <input
              className="input w-full"
              type="number"
              min={0}
              value={form.maxBookingsPerMonth ?? ""}
              onChange={(e) =>
                onFormChange("maxBookingsPerMonth", e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>
          <div>
            <label className="label">Named schedule</label>
            <select
              className="input w-full"
              value={form.namedScheduleId}
              onChange={(e) => onFormChange("namedScheduleId", e.target.value)}
            >
              <option value="">Workspace default hours</option>
              {namedScheduleOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[14px] font-semibold mb-3">Team ownership & permissions</h3>
        <p className="text-[12.5px] text-[#8a8fa3] mb-3">
          Restrict editing and booking access. Team-owned types appear on team booking pages.
        </p>
        <div className="mb-3">
          <label className="label">Owning team / scheduling group</label>
          <select
            className="input w-full"
            value={form.ownerTeamId}
            onChange={(e) => onFormChange("ownerTeamId", e.target.value)}
          >
            <option value="">Workspace-wide</option>
            {teamGroupOptions.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        {form.permissions.length === 0 ? (
          <p className="text-[12px] text-[#8a8fa3] rounded-lg border border-dashed border-[#ecedf2] px-3 py-3">
            No granular restrictions — all schedulers can manage this type.
          </p>
        ) : (
          <div className="space-y-2">
            {form.permissions.map((perm, i) => (
              <div key={`${perm.role}-${perm.userId || perm.teamId || i}`} className="grid grid-cols-4 gap-2 items-center">
                <select
                  className="input"
                  value={perm.role}
                  onChange={(e) => {
                    const next = [...form.permissions];
                    next[i] = { ...perm, role: e.target.value as typeof perm.role };
                    onFormChange("permissions", next);
                  }}
                >
                  {(["owner", "admin", "scheduler", "viewer"] as const).map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <input
                  className="input"
                  placeholder="User ID (optional)"
                  value={perm.userId || ""}
                  onChange={(e) => {
                    const next = [...form.permissions];
                    next[i] = { ...perm, userId: e.target.value || undefined };
                    onFormChange("permissions", next);
                  }}
                />
                <label className="flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    checked={perm.canEdit !== false}
                    onChange={(e) => {
                      const next = [...form.permissions];
                      next[i] = { ...perm, canEdit: e.target.checked };
                      onFormChange("permissions", next);
                    }}
                  />
                  Edit
                </label>
                <button
                  type="button"
                  onClick={() => onFormChange("permissions", form.permissions.filter((_, j) => j !== i))}
                >
                  <Trash2 size={14} className="text-[#a0a3b5]" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="mt-2 text-[12px] font-medium text-[#5b4bff] flex items-center gap-1"
          onClick={() =>
            onFormChange("permissions", [
              ...form.permissions,
              { role: "scheduler", canEdit: true, canBook: true, canView: true },
            ])
          }
        >
          <Plus size={14} /> Add permission rule
        </button>
      </section>
    </>
  );
}
