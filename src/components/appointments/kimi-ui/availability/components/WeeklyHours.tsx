import { Clock, CalendarDays, Plus, Trash2 } from "lucide-react";
import { weeklyHours } from "../mock-data";

export default function WeeklyHours() {
  return (
    <section className="avail-card avail-fade-in avail-fade-in-2">
      <div className="avail-card-header">
        <div className="flex items-start gap-3">
          <span className="avail-icon-chip mt-0.5">
            <Clock size={15} />
          </span>
          <div>
            <h2 className="text-[14.5px] font-semibold text-[#1c1a2e]">Weekly hours</h2>
            <p className="text-[12.5px] text-[#8a87a0] mt-0.5">
              Set your recurring availability. Add multiple windows to allow split shifts.
            </p>
          </div>
        </div>
        <button className="avail-btn-ghost">
          <CalendarDays size={13} />
          Copy from calendar
        </button>
      </div>

      <div className="px-[22px] py-3">
        {weeklyHours.map((d, i) => (
          <div
            key={d.day}
            className={`flex items-center gap-4 py-3.5 ${
              i < weeklyHours.length - 1 ? "border-b border-[#f2f1f7]" : ""
            }`}
          >
            <div className="w-[110px] flex items-center gap-2.5 shrink-0">
              <span className="text-[13px] font-semibold text-[#1c1a2e]">{d.day}</span>
              <span className={`avail-pill ${d.open ? "avail-pill-open" : "avail-pill-closed"}`}>
                {d.open ? "Open" : "Closed"}
              </span>
            </div>

            <div className="flex-1 flex items-center gap-3">
              {d.open ? (
                <>
                  <div className="avail-input flex items-center gap-2 w-[110px] justify-between font-medium text-[12.5px]">
                    {d.windows[0].start}
                    <Clock size={13} className="text-[#8a87a0]" />
                  </div>
                  <span className="text-[12.5px] text-[#8a87a0]">to</span>
                  <div className="avail-input flex items-center gap-2 w-[110px] justify-between font-medium text-[12.5px]">
                    {d.windows[0].end}
                    <Clock size={13} className="text-[#8a87a0]" />
                  </div>
                  <button className="avail-icon-btn" aria-label="Remove window">
                    <Trash2 size={14} />
                  </button>
                </>
              ) : (
                <span className="text-[13px] text-[#8a87a0]">{d.closedNote}</span>
              )}
            </div>

            <button className="avail-add-link shrink-0">
              <Plus size={14} />
              Add window
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
