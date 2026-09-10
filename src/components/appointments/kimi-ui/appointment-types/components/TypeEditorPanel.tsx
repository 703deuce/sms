"use client";

import { ChevronLeft, Info } from "lucide-react";
import TypeAdvancedSections from "./TypeAdvancedSections";
import TypePublishingSections from "./TypePublishingSections";
import { BookingTypeKindPicker } from "./BookingTypeKindPicker";
import { TypeResourcesSection } from "./TypeResourcesSection";
import { TypeAddOnsSection } from "./TypeAddOnsSection";
import { TypeCategoriesSection } from "./TypeCategoriesSection";
import { TypeIntakeFormsSection } from "./TypeIntakeFormsSection";
import { TypeServicePhasesSection } from "./TypeServicePhasesSection";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { EventTypeVideoSettings } from "@/components/video/event-type-video-settings";
import { EventTypeNotetakerSettings } from "@/components/meetings/event-type-notetaker-settings";
import { editorDefaultsForBookingTypeKind } from "@/lib/appointments/booking-type-kind";

interface Props {
  form: AppointmentTypeFormState;
  isCreating: boolean;
  saving: boolean;
  error: string;
  staffOptions: Array<{ id: string; name: string }>;
  locationOptions: Array<{ id: string; name: string }>;
  connectedPaymentProviders: Array<{ provider: "stripe" | "square"; label: string }>;
  namedScheduleOptions?: Array<{ id: string; name: string }>;
  teamGroupOptions?: Array<{ id: string; name: string }>;
  resourceOptions?: Array<{ id: string; name: string; quantity?: number }>;
  addOnOptions?: Array<{ id: string; name: string; priceCents?: number }>;
  categoryOptions?: Array<{ id: string; name: string }>;
  intakeFormOptions?: Array<{ id: string; name: string; active?: boolean }>;
  appointmentTypeId?: string | null;
  onFormChange: <K extends keyof AppointmentTypeFormState>(
    key: K,
    value: AppointmentTypeFormState[K],
  ) => void;
  onSave: () => void;
  onCancel: () => void;
  onBack: () => void;
  onManageAvailability: () => void;
  onCheckAvailability: () => void;
  onManageStaff: () => void;
  onManageLocations: () => void;
}

export default function TypeEditorPanel({
  form,
  isCreating,
  saving,
  error,
  staffOptions,
  locationOptions,
  connectedPaymentProviders,
  namedScheduleOptions,
  teamGroupOptions,
  resourceOptions = [],
  addOnOptions = [],
  categoryOptions = [],
  intakeFormOptions = [],
  appointmentTypeId = null,
  onFormChange,
  onSave,
  onCancel,
  onBack,
  onManageAvailability,
  onCheckAvailability,
  onManageStaff,
  onManageLocations,
}: Props) {
  const kindDefaults = editorDefaultsForBookingTypeKind(form.bookingTypeKind);

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
        <BookingTypeKindPicker
          form={form}
          isCreating={isCreating}
          onFormChange={onFormChange}
        />

        <section>
          <h3 className="text-[14px] font-semibold mb-4">Basic details</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label" htmlFor="appointment-type-name">Name</label>
              <input
                id="appointment-type-name"
                name="name"
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
              <select
                className="input w-full"
                value={form.location}
                onChange={(e) => {
                  const value = e.target.value;
                  onFormChange("location", value);
                  onFormChange("transovoVideoEnabled", value === "Transovo Video");
                  const externalMeeting =
                    value === "Zoom" ||
                    value === "Google Meet" ||
                    value === "Microsoft Teams" ||
                    value === "Webex" ||
                    value === "Custom meeting link";
                  if (externalMeeting) {
                    onFormChange("notetakerEnabled", true);
                    onFormChange("notetakerAutoJoin", true);
                  }
                }}
              >
                <option value="">Select location</option>
                <option value="In person">In person</option>
                <option value="Phone call">Phone call</option>
                <option value="Transovo Video">Transovo Video</option>
                <option value="Zoom">Zoom</option>
                <option value="Google Meet">Google Meet</option>
                <option value="Microsoft Teams">Microsoft Teams</option>
                <option value="Webex">Webex</option>
                <option value="Custom meeting link">Custom meeting link</option>
              </select>
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
          <EventTypeVideoSettings form={form} onChange={onFormChange} />
          <EventTypeNotetakerSettings form={form} onChange={onFormChange} />
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
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  className="text-[12px] font-medium text-[#5b4bff] hover:underline text-left"
                  onClick={onCheckAvailability}
                >
                  Check availability
                </button>
                <button
                  type="button"
                  className="text-[12px] font-medium text-[#5b4bff] hover:underline text-left"
                  onClick={onManageAvailability}
                >
                  Manage availability →
                </button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[14px] font-semibold">Team & locations</h3>
          </div>
          <div className="flex gap-3">
            <button type="button" className="text-[12px] font-medium text-[#5b4bff] hover:underline" onClick={onManageStaff}>
              Manage staff →
            </button>
            <button type="button" className="text-[12px] font-medium text-[#5b4bff] hover:underline" onClick={onManageLocations}>
              Manage locations →
            </button>
          </div>
        </section>

        <TypePublishingSections
          form={form}
          namedScheduleOptions={namedScheduleOptions}
          teamGroupOptions={teamGroupOptions}
          onFormChange={onFormChange}
        />

        <TypeCategoriesSection
          form={form}
          categoryOptions={categoryOptions}
          onFormChange={onFormChange}
        />

        <TypeResourcesSection
          form={form}
          resourceOptions={resourceOptions}
          onFormChange={onFormChange}
        />

        <TypeAddOnsSection form={form} addOnOptions={addOnOptions} onFormChange={onFormChange} />

        <TypeIntakeFormsSection
          form={form}
          intakeFormOptions={intakeFormOptions}
          onFormChange={onFormChange}
        />

        <TypeServicePhasesSection
          appointmentTypeId={appointmentTypeId}
          isCreating={isCreating}
        />

        <details
          className="rounded-xl border border-[#ecedf2] bg-[#fafbfc]/50"
          open={kindDefaults.advancedExpandedByDefault}
        >
          <summary className="cursor-pointer px-5 py-3.5 text-[14px] font-semibold text-[#1a1d29] list-none [&::-webkit-details-marker]:hidden">
            Advanced settings
            <span className="block text-[12px] font-normal text-[#8a8fa3] mt-0.5">
              Payment, recurrence, intake questions, policies, packages, add-ons, and more — available for every
              archetype.
            </span>
          </summary>
          <div className="px-5 pb-5 pt-2 space-y-8 border-t border-[#ecedf2]">
        <TypeAdvancedSections
          form={form}
          staffOptions={staffOptions}
          locationOptions={locationOptions}
          connectedPaymentProviders={connectedPaymentProviders}
          onFormChange={onFormChange}
        />
          </div>
        </details>

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
