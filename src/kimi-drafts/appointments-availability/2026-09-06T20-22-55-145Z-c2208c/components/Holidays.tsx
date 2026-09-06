"use client";

import { PartyPopper, Trash2, Plus } from "lucide-react";
import { formatOverrideDate, type Holiday } from "../mock-data";

type Props = {
  holidays: Holiday[];
  holidayDate: string;
  holidayName: string;
  holidayClosed: boolean;
  onDateChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onClosedChange: (v: boolean) => void;
  onAdd: () => void;
  onRemove: (date: string, name: string) => void;
};

export default function Holidays({
  holidays,
  holidayDate,
  holidayName,
  holidayClosed,
  onDateChange,
  onNameChange,
  onClosedChange,
  onAdd,
  onRemove,
}: Props) {
  return (
    <section className="avail-card avail-fade-in avail-fade-in-3">
      <div className="px-6 pt-5 pb-4 border-b border-[#f0eef6]">
        <h2 className="text-[15px] font-bold tracking-tight">Holiday calendar</h2>
        <p className="text-[12.5px] text-[#8a87a0] mt-0.5">
          Recurring company holidays. Closed holidays block all bookings for that date every year.
        </p>
      </div>

      {holidays.length > 0 ? (
        <ul className="divide-y divide-[#f3f1f8]">
          {holidays.map((h) => (
            <li key={`${h.date}-${h.name}`} className="px-6 py-3 flex items-center gap-3.5">
              <span className="w-9 h-9 rounded-lg bg-[#fdeef5] text-[#c2347f] flex items-center justify-center shrink-0">
                <PartyPopper size={15} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold truncate">{h.name}</p>
                <p className="text-[12px] text-[#8a87a0]">{formatOverrideDate(h.date)}</p>
              </div>
              <span
                className={`text-[10.5px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${
                  h.closed ? "bg-[#fdeaea] text-[#c33]" : "bg-[#e6f7ef] text-[#16a05a]"
                }`}
              >
                {h.closed ? "Closed" : "Open"}
              </span>
              <button
                type="button"
                aria-label={`Remove holiday ${h.name}`}
                className="avail-icon-btn"
                onClick={() => onRemove(h.date, h.name)}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-6 py-7 text-center">
          <PartyPopper size={20} className="mx-auto text-[#c9c6da]" />
          <p className="text-[13px] font-medium mt-2">No holidays configured</p>
          <p className="text-[12px] text-[#8a87a0] mt-0.5">Add company holidays below to block them automatically.</p>
        </div>
      )}

      <div className="px-6 py-4 border-t border-[#f0eef6] bg-[#fbfafd] rounded-b-xl">
        <p className="avail-label mb-2.5">Add holiday</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            aria-label="Holiday name"
            placeholder="Holiday name"
            className="avail-text !w-[180px]"
            value={holidayName}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <input
            type="date"
            aria-label="Holiday date"
            className="avail-time !w-[150px]"
            value={holidayDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-[12.5px] text-[#4a4760] cursor-pointer select-none">
            <input
              type="checkbox"
              className="avail-check"
              checked={holidayClosed}
              onChange={(e) => onClosedChange(e.target.checked)}
            />
            Closed
          </label>
          <button
            type="button"
            className="avail-btn-mini !text-[#5b45e0] !border-[#d9d5ec] hover:!bg-[#efecfd] disabled:opacity-50"
            onClick={onAdd}
            disabled={!holidayDate || !holidayName.trim()}
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </div>
    </section>
  );
}
