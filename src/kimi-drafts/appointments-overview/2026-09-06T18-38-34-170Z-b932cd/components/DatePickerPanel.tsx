import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  month: Date;             // first of visible month
  selected: Date;          // selected overview date
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelect: (d: Date) => void;
  onToday: () => void;
  onClose: () => void;
};

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DatePickerPanel({ month, selected, onPrevMonth, onNextMonth, onSelect, onToday, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDow = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const today = new Date();
  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, m, i + 1)),
  ];

  return (
    <div ref={ref} className="ref-pop" role="dialog" aria-label="Choose overview date">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-[13px] font-semibold text-gray-900">{monthLabel}</span>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
        >
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="mt-2.5 grid grid-cols-7 gap-0.5">
        {DOW.map((d) => (
          <span key={d} className="flex h-6 items-center justify-center text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">{d}</span>
        ))}
        {cells.map((d, i) =>
          d === null ? (
            <span key={`x${i}`} />
          ) : (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect(d)}
              className={[
                "ref-day",
                sameDay(d, today) ? "ref-day-today" : "",
                sameDay(d, selected) ? "ref-day-active" : "",
              ].join(" ").trim()}
              aria-pressed={sameDay(d, selected)}
            >
              {d.getDate()}
            </button>
          ),
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2.5">
        <button type="button" onClick={onToday} className="text-[12.5px] font-semibold text-indigo-600 hover:underline">
          Jump to today
        </button>
        <span className="text-[11px] text-gray-400">Times shown in Eastern Time</span>
      </div>
    </div>
  );
}
