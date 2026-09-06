"use client";

import { useRef, useState } from "react";
import { Check, Lock, AlertTriangle, Eye } from "lucide-react";
import MergeTagsCard from "./MergeTagsCard";
import SendTestCard from "./SendTestCard";
import ReminderCard from "./ReminderCard";
import SchedulePreview from "./SchedulePreview";
import CalendarDefaults from "./CalendarDefaults";
import type { ReminderItem } from "../mock-data";
import { MERGE_TAGS, TEST_STEP_OPTIONS, SMS_SENDER_LABEL } from "../mock-data";

export default function ReminderSettings({
  reminders,
  previewDegraded = false,
  readOnly = false,
}: {
  reminders: ReminderItem[];
  previewDegraded?: boolean;
  readOnly?: boolean;
}) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  // Merge-tag insertion targets the most recently focused template textarea.
  const textareas = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const lastFocused = useRef<string | null>(null);

  const markDirty = () => {
    setDirty(true);
    setSaved(false);
  };

  const save = () => {
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setDirty(false);
      setSaved(true);
    }, 800);
  };

  const registerTextarea = (id: string, el: HTMLTextAreaElement | null) => {
    if (el) textareas.current.set(id, el);
    else textareas.current.delete(id);
  };

  const focusTemplate = (id: string) => {
    lastFocused.current = id;
  };

  const insertTag = (tag: string) => {
    const el = lastFocused.current
      ? textareas.current.get(lastFocused.current)
      : undefined;
    if (!el || el.disabled) return false;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + tag + el.value.slice(end);
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    if (!setter) return false;
    setter.call(el, next);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
    const pos = start + tag.length;
    el.setSelectionRange(pos, pos);
    return true;
  };

  return (
    <div className="reminder-settings-page mx-auto max-w-[1100px] px-8 py-7">
      {/* Page header */}
      <div className="rs-page-head flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">
            Reminder Sequences
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-500">
            Automate appointment reminders to reduce no-shows and keep your schedule on track.
          </p>
        </div>
        <div className="rs-page-head-actions flex shrink-0 items-center gap-4 pt-1">
          {saved && !dirty && !saving ? (
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-600">
              <Check className="h-4 w-4" /> All changes saved
            </span>
          ) : dirty && !saving ? (
            <span className="text-[12.5px] font-medium text-amber-600">Unsaved changes</span>
          ) : null}
          {!readOnly ? (
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save reminder settings"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Read-only permission state */}
      {readOnly ? (
        <div className="rs-banner rs-banner-info mt-5" role="status">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>View-only access.</strong> Your role can view reminder settings but not
            change them. Ask a workspace admin to update this sequence.
          </span>
        </div>
      ) : null}

      {/* Partial/degraded state: settings loaded, previews failed */}
      {previewDegraded ? (
        <div className="rs-banner rs-banner-warn mt-5" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Customer previews couldn&apos;t be refreshed.</strong> Your saved reminder
            settings are shown below and are unchanged — previews may not reflect the latest
            templates. They will refresh on the next save.
          </span>
        </div>
      ) : null}

      {/* Tools */}
      <div className="rs-grid-2 mt-6 grid grid-cols-2 gap-4">
        <MergeTagsCard tags={MERGE_TAGS} onInsert={insertTag} />
        <SendTestCard options={TEST_STEP_OPTIONS} readOnly={readOnly} />
      </div>

      {/* Sequence */}
      <div className="mt-7">
        <h2 className="text-[15px] font-semibold tracking-tight text-gray-900">
          Reminder sequence
        </h2>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
          The booking confirmation is sent immediately after booking. Other reminders are
          scheduled relative to the appointment time. This sequence is your workspace default —
          individual booking types can override it.
        </p>
      </div>

      <div className="mt-1">
        {reminders.map((r) => (
          <ReminderCard
            key={r.id}
            reminder={r}
            onDirty={markDirty}
            readOnly={readOnly}
            registerTextarea={registerTextarea}
            onFocusTemplate={focusTemplate}
          />
        ))}
      </div>

      {/* Reminder schedule preview (state machine + delivery/tracking states) */}
      <div className="mt-7">
        <SchedulePreview />
      </div>

      {/* Per-calendar defaults */}
      <div className="mt-7">
        <CalendarDefaults readOnly={readOnly} onDirty={markDirty} />
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5 pb-6 text-[12px] text-gray-500">
        <Lock className="h-3.5 w-3.5" />
        {SMS_SENDER_LABEL}
      </div>
    </div>
  );
}
