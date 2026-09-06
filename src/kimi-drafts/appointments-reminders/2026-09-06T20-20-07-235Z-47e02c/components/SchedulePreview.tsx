"use client";

import {
  History,
  Smartphone,
  Mail,
  Check,
  Clock3,
  RefreshCw,
} from "lucide-react";
import {
  SCHEDULE_PREVIEW_APPOINTMENT,
  SCHEDULE_TIMELINE,
  SCHEDULE_REGENERATED_NOTE,
} from "../mock-data";

const CHANNEL_ICON = {
  sms: Smartphone,
  email: Mail,
  voice: Smartphone,
};

const DOT_ICON = {
  delivered: Check,
  clicked: Check,
  opened: Check,
  sent: Check,
  scheduled: Clock3,
  regenerated: RefreshCw,
} as const;

export default function SchedulePreview() {
  return (
    <section className="rs-card" aria-labelledby="schedule-preview-h">
      <div className="rs-card-hd">
        <span className="rs-icon-tile">
          <History className="h-4 w-4" />
        </span>
        <div>
          <h2 id="schedule-preview-h" className="text-[13.5px] font-semibold text-gray-900">
            Reminder schedule preview
          </h2>
          <p className="text-[12px] text-gray-500">
            How this sequence plays out for a real upcoming appointment — including delivery
            and email tracking states.
          </p>
        </div>
      </div>

      <div className="px-4 pt-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-gray-900">
            {SCHEDULE_PREVIEW_APPOINTMENT.customer}
          </span>
          <span className="text-[12.5px] text-gray-500">
            {SCHEDULE_PREVIEW_APPOINTMENT.service} · {SCHEDULE_PREVIEW_APPOINTMENT.when}
          </span>
        </div>
      </div>

      <ol className="rs-timeline mx-4 mb-2 mt-2">
        {SCHEDULE_TIMELINE.map((event) => {
          const ChannelIcon = CHANNEL_ICON[event.channel];
          const DotIcon = DOT_ICON[event.state];
          return (
            <li key={event.id} className="rs-timeline-item" data-state={event.state}>
              <span className="rs-timeline-dot" aria-hidden="true">
                <DotIcon className="h-2.5 w-2.5" />
              </span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ChannelIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                <span className="text-[13px] font-medium text-gray-900">{event.label}</span>
                <span
                  className={
                    event.state === "scheduled"
                      ? "rs-chip rs-chip-scheduled"
                      : "rs-chip rs-chip-done"
                  }
                >
                  {event.stateLabel}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-gray-500">
                {event.detail} · {event.time}
              </p>
            </li>
          );
        })}
        <li className="rs-timeline-item" data-state="regenerated">
          <span className="rs-timeline-dot" aria-hidden="true">
            <RefreshCw className="h-2.5 w-2.5" />
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-medium text-gray-900">
              Reschedule detected — reminders recalculated
            </span>
            <span className="rs-chip rs-chip-note">Updated</span>
          </div>
          <p className="mt-0.5 text-[12px] text-gray-500">{SCHEDULE_REGENERATED_NOTE}</p>
        </li>
      </ol>

      <p className="border-t border-gray-100 px-4 py-3 text-[12px] leading-relaxed text-gray-500">
        If an appointment is rescheduled or canceled, pending reminders are stopped and the
        schedule is recalculated automatically. When a customer replies, steps marked
        &ldquo;stop on reply&rdquo; are suppressed instead of failing.
      </p>
    </section>
  );
}
