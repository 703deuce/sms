"use client";

import type { ReminderItem } from "@/features/appointments/kimi/reminders/types";
import type { ReminderChannel } from "@/lib/appointments/types";
import { REMINDER_MERGE_TAGS } from "@/features/appointments/kimi/reminders/map-reminders";

type Props = {
  step: ReminderItem | null;
  onClose: () => void;
  onTemplateChange: (template: string) => void;
  onChannelChange: (channel: ReminderChannel) => void;
  onReset: () => void;
  onRemove?: () => void;
  onAdvancedChange: (patch: Record<string, unknown>) => void;
};

export function RemindersStepDrawer({
  step,
  onClose,
  onTemplateChange,
  onChannelChange,
  onReset,
  onRemove,
  onAdvancedChange,
}: Props) {
  if (!step) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-black/40" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-lg flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-base font-semibold">Edit reminder</h2>
          <button type="button" className="ws-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <label className="block text-sm">
            Step name
            <input
              className="input mt-1 w-full"
              value={step.title}
              onChange={(e) => onAdvancedChange({ label: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Channel
            <select
              className="input mt-1 w-full"
              value={step.channel}
              onChange={(e) => onChannelChange(e.target.value as ReminderChannel)}
            >
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="voice">Voice</option>
            </select>
          </label>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">Message</span>
              <button type="button" className="ws-text-btn text-xs" onClick={onReset}>Reset default</button>
            </div>
            <textarea
              className="input min-h-[120px] w-full font-mono text-sm"
              value={step.template}
              onChange={(e) => onTemplateChange(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {step.template.length} chars
              {step.channel === "sms" ? ` · ${step.segments} segment(s)` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Insert variable</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {REMINDER_MERGE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="ws-chip ws-chip-neutral text-[10px]"
                  onClick={() => onTemplateChange(`${step.template}${step.template.endsWith(" ") ? "" : " "}${tag}`)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          {step.stepKey !== "confirmation" ? (
            <div className="space-y-2 rounded border border-[var(--border)] p-3 text-sm">
              <p className="font-medium">Delivery rules</p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(step.skipWeekends)}
                  onChange={(e) => onAdvancedChange({ skipWeekends: e.target.checked })}
                />
                Skip weekends
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(step.skipOffHours)}
                  onChange={(e) => onAdvancedChange({ skipOffHours: e.target.checked })}
                />
                Skip off-hours
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(step.stopOnReply)}
                  onChange={(e) => onAdvancedChange({ stopOnReply: e.target.checked })}
                />
                Stop after customer replies
              </label>
            </div>
          ) : null}
          <div className="rounded border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm">
            <p className="text-xs font-medium text-[var(--text-secondary)]">Preview</p>
            <p className="mt-2 whitespace-pre-wrap">{step.preview || step.template}</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
          {step.isCustom && onRemove ? (
            <button type="button" className="ws-text-btn danger text-sm" onClick={onRemove}>Delete step</button>
          ) : (
            <span />
          )}
          <button type="button" className="appt-pilot-primary-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
