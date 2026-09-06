"use client";
import React, { useEffect, useState } from "react";
import { X, Search } from "lucide-react";

type Props = {
  open: boolean;
  dayLabel?: string;
  timeLabel?: string;
  onClose: () => void;
  onSave: () => void;
};

const BOOKING_TYPES = ["Consultation", "Call", "Follow-up", "Onboarding"];
const CONTACTS = ["Sarah Johnson", "Marcus Lee", "Priya Patel", "Emily Chen", "Alicia Gomez"];

export default function NewAppointmentDrawer({ open, dayLabel, timeLabel, onClose, onSave }: Props) {
  const [customer, setCustomer] = useState("");
  const [type, setType] = useState(BOOKING_TYPES[0]);
  const [duration, setDuration] = useState("30 min");
  const [reminder, setReminder] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="cal-overlay" onClick={onClose} />
      <div className="cal-drawer" role="dialog" aria-label="New appointment">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">New appointment</h2>
            {(dayLabel || timeLabel) && (
              <p className="text-[12px] text-gray-500">{dayLabel}{dayLabel && timeLabel ? " · " : ""}{timeLabel}</p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div>
            <label htmlFor="na-customer" className="mb-1.5 block text-[12px] font-semibold text-gray-700">Customer</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                id="na-customer"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                list="na-contacts"
                placeholder="Search contacts or enter a name"
                className="h-9 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <datalist id="na-contacts">
                {CONTACTS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div>
            <label htmlFor="na-type" className="mb-1.5 block text-[12px] font-semibold text-gray-700">Booking type</label>
            <select
              id="na-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-9 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {BOOKING_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="na-date" className="mb-1.5 block text-[12px] font-semibold text-gray-700">Date</label>
              <input id="na-date" defaultValue={dayLabel || "Wed, Sep 17"} className="h-9 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label htmlFor="na-time" className="mb-1.5 block text-[12px] font-semibold text-gray-700">Start time</label>
              <input id="na-time" defaultValue={timeLabel || "9:00 AM"} className="h-9 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
          </div>
          <div>
            <label htmlFor="na-duration" className="mb-1.5 block text-[12px] font-semibold text-gray-700">Duration</label>
            <select id="na-duration" value={duration} onChange={(e) => setDuration(e.target.value)} className="h-9 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
              {["15 min", "30 min", "45 min", "60 min"].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="na-notes" className="mb-1.5 block text-[12px] font-semibold text-gray-700">Notes <span className="font-normal text-gray-400">— Optional</span></label>
            <textarea id="na-notes" rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </div>
          <label className="flex items-center gap-2.5 text-[13px] text-gray-700">
            <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
            Send SMS confirmation and reminders
          </label>
          <p className="text-[11px] text-gray-400">Times shown in Eastern Time (EDT)</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-4 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onSave} className="h-9 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white hover:bg-indigo-500">
            Create appointment
          </button>
        </div>
      </div>
    </>
  );
}
