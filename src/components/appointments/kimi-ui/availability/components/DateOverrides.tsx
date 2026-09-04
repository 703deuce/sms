import { CalendarDays, Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { overrides } from "../mock-data";

export default function DateOverrides() {
  return (
    <section className="avail-card avail-fade-in avail-fade-in-3">
      <div className="avail-card-header">
        <div className="flex items-start gap-3">
          <span className="avail-icon-chip mt-0.5">
            <CalendarDays size={15} />
          </span>
          <div>
            <h2 className="text-[14.5px] font-semibold text-[#1c1a2e]">Date overrides</h2>
            <p className="text-[12.5px] text-[#8a87a0] mt-0.5">
              Close specific dates or set custom hours for vacations, holidays, and special availability.
            </p>
          </div>
        </div>
        <button className="avail-btn-ghost">
          <Plus size={13} />
          Add override
        </button>
      </div>

      <div className="px-[22px] pt-4 pb-2">
        <div className="grid grid-cols-[220px_130px_190px_1fr_70px] gap-3 pb-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#8a87a0]">
          <span>Date</span>
          <span>Type</span>
          <span>Hours</span>
          <span>Note</span>
          <span />
        </div>

        {overrides.map((o) => (
          <div
            key={o.date}
            className="grid grid-cols-[220px_130px_190px_1fr_70px] gap-3 items-center py-3 border-t border-[#f2f1f7]"
          >
            <div className="flex items-center gap-3">
              <div className="w-[34px] text-center shrink-0">
                <div className="text-[9.5px] font-bold tracking-wider text-[#8a87a0]">{o.month}</div>
                <div className="text-[15px] font-bold text-[#1c1a2e] leading-tight">{o.dayNum}</div>
              </div>
              <span className="text-[13px] font-medium text-[#1c1a2e]">{o.date}</span>
            </div>
            <div>
              <span className={`avail-pill ${o.type === "custom" ? "avail-pill-custom" : "avail-pill-rose"}`}>
                {o.type === "custom" ? "Custom hours" : "Closed all day"}
              </span>
            </div>
            <span className="text-[13px] text-[#4a4763]">{o.hours}</span>
            <span className="text-[13px] text-[#4a4763]">{o.note}</span>
            <div className="flex items-center justify-end gap-1">
              <button className="avail-icon-btn" aria-label="Edit override">
                <Pencil size={14} />
              </button>
              <button className="avail-icon-btn" aria-label="Delete override">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full flex items-center justify-center gap-1.5 py-3.5 text-[13px] font-semibold text-[#5b45e0] border-t border-[#f2f1f7] hover:bg-[#faf9fd] transition-colors rounded-b-[14px]">
        View all overrides
        <ChevronDown size={15} />
      </button>
    </section>
  );
}
