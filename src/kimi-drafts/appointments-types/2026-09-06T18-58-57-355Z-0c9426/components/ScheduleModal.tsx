"use client";

import { useEffect, useRef, useState } from "react";
import { X, Clock } from "lucide-react";

type Props = {
  scheduleName: string;
  onClose: () => void;
};

const DEFAULT_HOURS: Array<{ day: string; enabled: boolean; start: string; end: string }> = [
  { day: "Monday", enabled: true, start: "9:00 AM", end: "5:00 PM" },
  { day: "Tuesday", enabled: true, start: "9:00 AM", end: "5:00 PM" },
  { day: "Wednesday", enabled: true, start: "9:00 AM", end: "5:00 PM" },
  { day: "Thursday", enabled: true, start: "9:00 AM", end: "5:00 PM" },
  { day: "Friday", enabled: true, start: "9:00 AM", end: "5:00 PM" },
  { day: "Saturday", enabled: false, start: "9:00 AM", end: "1:00 PM" },
  { day: "Sunday", enabled: false, start: "9:00 AM", end: "1:00 PM" },
];

export default function ScheduleModal({ scheduleName, onClose }: Props) {
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [saved, setSaved] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const update = (idx: number, patch: Partial<(typeof hours)[number]>) =>
    setHours((h) => h.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  return (
    <div className="modal-scrim" role="presentation" onClick={onClose}>
      <div
        className="modal-card modal-card-lg animate-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ecedf2]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef0fd] text-[#4f46e5] shrink-0">
              <Clock size={15} />
            </span>
            <div className="min-w-0">
              <h3 id="schedule-title" className="text-[15px] font-semibold text-[#1a1d29]">
                {scheduleName}
              </h3>
              <p className="text-[12px] text-[#8a8fa3]">Weekly availability · Eastern Time (ET)</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="p-1.5 rounded-md text-[#a7abb9] hover:bg-[#f2f4f7] hover:text-[#3c4257]"
            onClick={onClose}
            aria-label="Close schedule"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="space-y-1">
            {hours.map((row, i) => (
              <div key={row.day} className="flex items-center gap-3 py-1.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.enabled}
                  aria-label={`${row.day} available`}
                  className="toggle"
                  onClick={() => update(i, { enabled: !row.enabled })}
                />
                <span className={`w-24 text-[13px] font-medium ${row.enabled ? "text-[#3c4257]" : "text-[#a7abb9]"}`}>
                  {row.day}
                </span>
                {row.enabled ? (
                  <div className="flex items-center gap-2">
                    <select
                      className="field-input !h-8 !w-28 text-[12.5px]"
                      style={{ height: 32, width: 112 }}
                      value={row.start}
                      onChange={(e) => update(i, { start: e.target.value })}
                      aria-label={`${row.day} start time`}
                    >
                      {["7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <span className="text-[12px] text-[#8a8fa3]">to</span>
                    <select
                      className="field-input !h-8 !w-28 text-[12.5px]"
                      style={{ height: 32, width: 112 }}
                      value={row.end}
                      onChange={(e) => update(i, { end: e.target.value })}
                      aria-label={`${row.day} end time`}
                    >
                      {["1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-[12.5px] text-[#a7abb9]">Unavailable</span>
                )}
              </div>
            ))}
          </div>
          <p className="field-hint mt-3">
            Changes to this schedule apply to every booking type using it.
          </p>
          <div className="flex items-center justify-end gap-2.5 mt-4">
            <button type="button" className="btn-secondary h-9 px-4 rounded-lg text-[13px] font-medium" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="btn-brand h-9 px-4 rounded-lg text-[13px] font-semibold shadow-sm transition-all active:scale-[0.98]"
              onClick={() => {
                setSaved(true);
                setTimeout(onClose, 700);
              }}
            >
              {saved ? "Saved" : "Save schedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
