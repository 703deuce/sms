"use client";

import { CalendarX2, CalendarPlus, Trash2, Plus } from "lucide-react";
import { formatOverrideDate, formatWindowRange, type DateOverride } from "../mock-data";

type Props = {
  overrides: DateOverride[];
  overrideDate: string;
  overrideClosed: boolean;
  overrideOpen: string;
  overrideClose: string;
  onOverrideDateChange: (v: string) => void;
  onOverrideClosedChange: (v: boolean) => void;
  onOverrideOpenChange: (v: string) => void;
  onOverrideCloseChange: (v: string) => void;
  onAddOverride: () => void;
  onRemoveOverride: (date: string) => void;
};

export default function DateOverrides({
  overrides,
  overrideDate,
  overrideClosed,
  overrideOpen,
  overrideClose,
  onOverrideDateChange,
  onOverrideClosedChange,
  onOverrideOpenChange,
  onOverrideCloseChange,
  onAddOverride,
  onRemoveOverride,
}: Props) {
  return (
    <section className="avail-card avail-fade-in avail-fade-in-3">
      <div className="px-6 pt-5 pb-4 border-b border-[#f0eef6]">
        <h2 className="text-[15px] font-bold tracking-tight">Date overrides</h2>
        <p className="text-[12.5px] text-[#8a87a0] mt-0.5">
          Close specific dates or set custom hours — holidays, events, one-off changes.
        </p>
      </div>

      {overrides.length > 0 ? (
        <ul className="divide-y divide-[#f3f1f8]">
          {overrides.map((o) => {
            const d = new Date(`${o.date}T12:00:00`);
            const month = Number.isNaN(d.getTime())
              ? ""
              : d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
            const dayNum = Number.isNaN(d.getTime()) ? "" : String(d.getDate());
            return (
              <li key={o.date} className="px-6 py-3 flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-[#f4f2fa] border border-[#eceaf3] flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold tracking-wider text-[#8a87a0] leading-none">{month}</span>
                  <span className="text-[15px] font-bold leading-tight">{dayNum}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold truncate">{formatOverrideDate(o.date)}</p>
                  <p className="text-[12px] text-[#8a87a0]">
                    {o.closed ? "Closed all day" : formatWindowRange(o.windows || [])}
                  </p>
                </div>
                <span
                  className={`text-[10.5px] font-semibold rounded-full px-2 py-0.5 ${
                    o.closed ? "bg-[#fdeaea] text-[#c33]" : "bg-[#efecfd] text-[#5b45e0]"
                  }`}
                >
                  {o.closed ? "Closed" : "Custom hours"}
                </span>
                <button
                  type="button"
                  aria-label={`Remove override for ${formatOverrideDate(o.date)}`}
                  className="avail-icon-btn"
                  onClick={() => onRemoveOverride(o.date)}
                >
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-6 py-8 text-center">
          <CalendarX2 size={22} className="mx-auto text-[#c9c6da]" />
          <p className="text-[13px] font-medium mt-2">No date overrides</p>
          <p className="text-[12px] text-[#8a87a0] mt-0.5">
            Add one below to close a date or change hours for a specific day.
          </p>
        </div>
      )}

      <div className="px-6 py-4 border-t border-[#f0eef6] bg-[#fbfafd] rounded-b-xl">
        <p className="avail-label flex items-center gap-1.5 mb-2.5">
          <CalendarPlus size={12} className="text-[#5b45e0]" /> Add override
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Override date"
            className="avail-time !w-[150px]"
            value={overrideDate}
            onChange={(e) => onOverrideDateChange(e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-[12.5px] text-[#4a4760] cursor-pointer select-none">
            <input
              type="checkbox"
              className="avail-check"
              checked={overrideClosed}
              onChange={(e) => onOverrideClosedChange(e.target.checked)}
            />
            Closed all day
          </label>
          {!overrideClosed && (
            <>
              <input
                type="time"
                aria-label="Override open time"
                className="avail-time"
                value={overrideOpen}
                onChange={(e) => onOverrideOpenChange(e.target.value)}
              />
              <span className="text-[12px] text-[#8a87a0]">to</span>
              <input
                type="time"
                aria-label="Override close time"
                className="avail-time"
                value={overrideClose}
                onChange={(e) => onOverrideCloseChange(e.target.value)}
              />
            </>
          )}
          <button
            type="button"
            className="avail-btn-mini !text-[#5b45e0] !border-[#d9d5ec] hover:!bg-[#efecfd] disabled:opacity-50"
            onClick={onAddOverride}
            disabled={!overrideDate}
          >
            <Plus size={12} />
            Add
          </button>
        </div>
      </div>
    </section>
  );
}
