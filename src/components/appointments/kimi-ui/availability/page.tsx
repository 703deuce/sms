"use client";

import { Clock, BookOpen } from "lucide-react";
import BookingRules from "./components/BookingRules";
import WeeklyHours from "./components/WeeklyHours";
import DateOverrides from "./components/DateOverrides";
import AvailabilitySummary from "./components/AvailabilitySummary";
import LivePreview from "./components/LivePreview";
import type {
  AvailabilityPageActions,
  AvailabilityPageModel,
} from "@/features/appointments/kimi/availability/types";
import "./reference.css";

type Props = {
  model: AvailabilityPageModel;
  actions: AvailabilityPageActions;
};

export default function AvailabilityView({ model, actions }: Props) {
  return (
    <div className="avail-page min-h-full bg-[#f8f7fc] text-[#1c1a2e]">
      <div className="max-w-[1280px] mx-auto px-10 pt-9 pb-10">
        <div className="flex items-start justify-between mb-7 avail-fade-in">
          <div className="flex items-start gap-3.5">
            <span className="w-10 h-10 rounded-full bg-[#dcefeb] text-[#147d74] flex items-center justify-center mt-0.5 ring-4 ring-[#dcefeb]/40">
              <Clock size={19} strokeWidth={2.1} />
            </span>
            <div>
              <h1 className="text-[21px] leading-7 font-bold tracking-tight">
                Availability
              </h1>
              <p className="text-[13px] text-[#8a87a0] mt-1 leading-snug">
                Control when customers can book. Public booking, manual booking, and slot validation all use these rules.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="avail-btn-ghost !bg-white border !border-[#e9e7f2] shadow-[0_1px_2px_rgba(28,26,46,0.05)] hover:!border-[#d9d5ec] hover:text-[#147d74] transition-colors"
          >
            <BookOpen size={13} />
            Learn about availability
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_288px] gap-6 items-start">
          <div className="space-y-5 min-w-0">
            <BookingRules
              rules={model.bookingRules}
              onTimezoneChange={actions.onTimezoneChange}
              onMinimumNoticeChange={actions.onMinimumNoticeChange}
              onMaximumDaysChange={actions.onMaximumDaysChange}
            />
            <WeeklyHours
              days={model.weeklyHours}
              onUpdateWindow={actions.onUpdateWindow}
              onAddWindow={actions.onAddWindow}
              onRemoveWindow={actions.onRemoveWindow}
            />
            <DateOverrides
              overrides={model.overrides}
              form={model.form}
              onOverrideDateChange={actions.onOverrideDateChange}
              onOverrideClosedChange={actions.onOverrideClosedChange}
              onOverrideOpenChange={actions.onOverrideOpenChange}
              onOverrideCloseChange={actions.onOverrideCloseChange}
              onAddOverride={actions.onAddOverride}
              onRemoveOverride={actions.onRemoveOverride}
            />
          </div>

          <div className="space-y-5 xl:sticky xl:top-6">
            <AvailabilitySummary items={model.summary} />
            <LivePreview days={model.previewDays} />
          </div>
        </div>

        <div className="avail-card avail-fade-in avail-fade-in-3 mt-6 flex items-center justify-between gap-4 px-6 py-4 border-t border-[#eceaf3]">
          <p className="text-[12.5px] text-[#8a87a0]">
            Changes apply immediately to all booking channels.
            {model.saved ? (
              <span className="ml-1.5 inline-flex items-center gap-1 font-medium text-[#16a05a]">
                Saved.
              </span>
            ) : null}
          </p>
          <button
            type="button"
            className="avail-btn-primary shadow-[0_1px_2px_rgba(91,69,224,0.25)] disabled:opacity-60 disabled:shadow-none"
            onClick={actions.onSave}
            disabled={model.saving}
          >
            {model.saving ? "Saving…" : "Save availability"}
          </button>
        </div>
      </div>
    </div>
  );
}
