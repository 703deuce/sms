"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  MessageSquare,
  Mail,
  Smartphone,
  Phone,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import type { ReminderItem, ReminderChannel } from "../mock-data";
import { DEFAULT_TEMPLATES } from "../mock-data";

const ICONS = {
  calendar: Calendar,
  clock: Clock,
  message: MessageSquare,
};

export default function ReminderCard({
  reminder,
  onDirty,
  readOnly = false,
  registerTextarea,
  onFocusTemplate,
}: {
  reminder: ReminderItem;
  onDirty: () => void;
  readOnly?: boolean;
  registerTextarea?: (id: string, el: HTMLTextAreaElement | null) => void;
  onFocusTemplate?: (id: string) => void;
}) {
  const [enabled, setEnabled] = useState(reminder.enabled);
  const [channel, setChannel] = useState<ReminderChannel>(reminder.channel);
  const [template, setTemplate] = useState(reminder.template);
  const [skipWeekends, setSkipWeekends] = useState(!!reminder.skipWeekends);
  const [skipOffHours, setSkipOffHours] = useState(!!reminder.skipOffHours);
  const [skipClosedDays, setSkipClosedDays] = useState(!!reminder.skipClosedDays);
  const [stopOnReply, setStopOnReply] = useState(!!reminder.stopOnReply);
  const [attachIcs, setAttachIcs] = useState(!!reminder.attachIcs);
  const [timeOfDayAt, setTimeOfDayAt] = useState(reminder.timeOfDayAt ?? "");

  const Icon = ICONS[reminder.icon];
  const isCustom = template !== DEFAULT_TEMPLATES[reminder.stepKey];
  const segments = Math.max(1, Math.ceil(template.length / 160));
  const fieldsDisabled = !enabled || readOnly;

  return (
    <section
      className="rs-card reminder-card mt-4"
      data-disabled={!enabled}
      aria-labelledby={`reminder-${reminder.id}-h`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-4 pt-4">
        <div className="flex items-start gap-3">
          <span className="rs-icon-tile mt-0.5">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={`reminder-${reminder.id}-h`} className="text-[14px] font-semibold text-gray-900">
                {reminder.index}. {reminder.title}
              </h3>
              <span className="rs-badge">{reminder.badge}</span>
              <span className={enabled ? "rs-badge rs-badge-on" : "rs-badge rs-badge-off"}>
                {enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="mt-0.5 text-[12.5px] text-gray-500">{reminder.description}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`Enable ${reminder.title}`}
          className="rs-switch"
          disabled={readOnly}
          onClick={() => {
            setEnabled(!enabled);
            onDirty();
          }}
        />
      </div>

      {/* Body */}
      <div className="px-4 pb-4 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-medium text-gray-600">Message channel</span>
          <div className="rs-channel" role="group" aria-label="Channel">
            <button
              type="button"
              data-active={channel === "sms"}
              disabled={fieldsDisabled}
              aria-pressed={channel === "sms"}
              onClick={() => {
                setChannel("sms");
                onDirty();
              }}
            >
              <Smartphone className="h-3.5 w-3.5" /> SMS
            </button>
            <button
              type="button"
              data-active={channel === "email"}
              disabled={fieldsDisabled}
              aria-pressed={channel === "email"}
              onClick={() => {
                setChannel("email");
                onDirty();
              }}
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </button>
            <button
              type="button"
              data-active={channel === "voice"}
              disabled={fieldsDisabled}
              aria-pressed={channel === "voice"}
              onClick={() => {
                setChannel("voice");
                onDirty();
              }}
            >
              <Phone className="h-3.5 w-3.5" /> Voice
            </button>
          </div>
        </div>

        {channel === "voice" ? (
          <p className="mb-2 text-[11.5px] leading-relaxed text-gray-500">
            Voice reminders call the customer and play your reminder script. SMS is recommended
            when a mobile number is available.
          </p>
        ) : null}
        {channel === "email" ? (
          <p className="mb-2 text-[11.5px] leading-relaxed text-gray-500">
            Email reminders include delivery, open, and link-click tracking. A calendar invite
            (.ics) can be attached below.
          </p>
        ) : null}

        <label htmlFor={`tpl-${reminder.id}`} className="mb-1 block text-[12px] font-medium text-gray-600">
          {channel === "voice" ? "Voice script" : "Template"}
        </label>
        <textarea
          id={`tpl-${reminder.id}`}
          ref={(el) => registerTextarea?.(reminder.id, el)}
          className="rs-template"
          value={template}
          disabled={fieldsDisabled}
          onFocus={() => onFocusTemplate?.(reminder.id)}
          onChange={(e) => {
            setTemplate(e.target.value);
            onDirty();
          }}
        />
        <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-gray-500">
          <span>
            {channel === "sms" ? (
              <>
                {template.length} characters · {segments} SMS segment{segments === 1 ? "" : "s"}
              </>
            ) : (
              <>{template.length} characters</>
            )}
          </span>
          {isCustom ? (
            <button
              type="button"
              disabled={fieldsDisabled}
              onClick={() => {
                setTemplate(DEFAULT_TEMPLATES[reminder.stepKey]);
                onDirty();
              }}
              className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" /> Reset to default
            </button>
          ) : (
            <span className="text-gray-400">Using default template</span>
          )}
        </div>

        <div className="mt-3">
          <span className="mb-1 block text-[12px] font-medium text-gray-600">
            Customer preview
          </span>
          <div className="rs-preview">{reminder.preview}</div>
        </div>

        {/* Advanced timing */}
        <details className="rs-advanced mt-3.5">
          <summary>
            Advanced delivery options <ChevronDown className="h-3.5 w-3.5" />
          </summary>
          <div className="rs-advanced-grid mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-lg border border-gray-100 bg-gray-50 p-3.5">
            <label className="rs-check" data-disabled={fieldsDisabled}>
              <input
                type="checkbox"
                checked={skipWeekends}
                disabled={fieldsDisabled}
                onChange={(e) => {
                  setSkipWeekends(e.target.checked);
                  onDirty();
                }}
              />
              Skip weekends
            </label>
            <label className="rs-check" data-disabled={fieldsDisabled}>
              <input
                type="checkbox"
                checked={skipClosedDays}
                disabled={fieldsDisabled}
                onChange={(e) => {
                  setSkipClosedDays(e.target.checked);
                  onDirty();
                }}
              />
              Skip days your business is closed
            </label>
            <label className="rs-check" data-disabled={fieldsDisabled}>
              <input
                type="checkbox"
                checked={skipOffHours}
                disabled={fieldsDisabled}
                onChange={(e) => {
                  setSkipOffHours(e.target.checked);
                  onDirty();
                }}
              />
              Only send during business hours
            </label>
            <label className="rs-check" data-disabled={fieldsDisabled}>
              <input
                type="checkbox"
                checked={stopOnReply}
                disabled={fieldsDisabled}
                onChange={(e) => {
                  setStopOnReply(e.target.checked);
                  onDirty();
                }}
              />
              Stop remaining reminders when customer replies
            </label>
            {channel === "email" ? (
              <label className="rs-check" data-disabled={fieldsDisabled}>
                <input
                  type="checkbox"
                  checked={attachIcs}
                  disabled={fieldsDisabled}
                  onChange={(e) => {
                    setAttachIcs(e.target.checked);
                    onDirty();
                  }}
                />
                Attach calendar invite (.ics)
              </label>
            ) : null}
            {reminder.timeOfDayAt !== undefined ? (
              <div className="col-span-2 flex flex-wrap items-center gap-2 pt-1 text-[12.5px] text-gray-600">
                <span>Send at</span>
                <input
                  type="time"
                  className="rs-input h-8"
                  value={timeOfDayAt}
                  disabled={fieldsDisabled}
                  onChange={(e) => {
                    setTimeOfDayAt(e.target.value);
                    onDirty();
                  }}
                  aria-label="Send time of day"
                />
                <span className="text-gray-500">
                  {reminder.timeOfDayDaysBefore === 1
                    ? "the day before the appointment"
                    : `${reminder.timeOfDayDaysBefore ?? 0} days before the appointment`}
                </span>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </section>
  );
}
