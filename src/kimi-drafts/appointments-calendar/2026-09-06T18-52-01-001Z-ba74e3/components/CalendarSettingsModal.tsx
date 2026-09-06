"use client";
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

type Props = { open: boolean; onClose: () => void };

export default function CalendarSettingsModal({ open, onClose }: Props) {
  const [weekStart, setWeekStart] = useState("Sunday");
  const [showCanceled, setShowCanceled] = useState(true);
  const [showWeekends, setShowWeekends] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="cal-overlay" onClick={onClose} />
      <div className="cal-modal" role="dialog" aria-label="Calendar settings">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-gray-900">Calendar settings</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 px-5 py-5">
          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Display</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="cs-weekstart" className="mb-1.5 block text-[12px] font-semibold text-gray-700">Week starts on</label>
                <select id="cs-weekstart" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                  <option>Sunday</option>
                  <option>Monday</option>
                </select>
              </div>
              <label className="flex items-center gap-2.5 text-[13px] text-gray-700">
                <input type="checkbox" checked={showCanceled} onChange={(e) => setShowCanceled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                Show canceled appointments
              </label>
              <label className="flex items-center gap-2.5 text-[13px] text-gray-700">
                <input type="checkbox" checked={showWeekends} onChange={(e) => setShowWeekends(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                Show weekends in week view
              </label>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Working hours</h3>
            <p className="text-[13px] text-gray-600">Monday – Friday · 8:00 AM – 6:00 PM · Eastern Time (EDT)</p>
            <button className="mt-1.5 text-[12px] font-medium text-indigo-600 hover:text-indigo-500">
              Edit availability in Booking → Availability
            </button>
          </div>
          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Connected calendars</h3>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5">
              <div>
                <div className="text-[13px] font-medium text-gray-800">Transovo Calendar</div>
                <div className="text-[11px] text-gray-400">Primary · Source of truth</div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span>
            </div>
            <button className="mt-1.5 text-[12px] font-medium text-indigo-600 hover:text-indigo-500">
              Manage connected calendars in Integrations
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-4 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onClose} className="h-9 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white hover:bg-indigo-500">
            Save changes
          </button>
        </div>
      </div>
    </>
  );
}
