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
    <div className="avail-page min-h-full bg-[#f7f6fb] text-[#1c1a2e]">
      <div className="max-w-[1240px] mx-auto px-8 py-7">
        <div className="flex items-start justify-between mb-6 avail-fade-in">
          <div className="flex items-start gap-3.5">
            <span className="w-10 h-10 rounded-full bg-[#efecfd] text-[#5b45e0] flex items-center justify-center mt-0.5">
              <Clock size={20} />
            </span>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight">Availability</h1>
              <p className="text-[13px] text-[#8a87a0] mt-0.5">
                Control when customers can book. Public booking, manual booking, and slot validation all use these rules.
              </p>
            </div>
          </div>
          <button type="button" className="avail-btn-ghost !bg-white border !border-[#eceaf3] shadow-sm">
            <BookOpen size={13} />
            Learn about availability
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">
          <div className="space-y-5">
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

            <div className="avail-card avail-fade-in avail-fade-in-3 flex items-center justify-between px-[22px] py-4">
              <p className="text-[12.5px] text-[#8a87a0]">
                Changes apply immediately to all booking channels.
                {model.saved ? " Saved." : ""}
              </p>
              <button
                type="button"
                className="avail-btn-primary disabled:opacity-60"
                onClick={actions.onSave}
                disabled={model.saving}
              >
                {model.saving ? "Saving…" : "Save availability"}
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <AvailabilitySummary items={model.summary} />
            <LivePreview days={model.previewDays} />
          </div>
        </div>
      </div>
    </div>
  );
}
