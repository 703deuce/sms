import { CalendarDays, Plus, Trash2 } from "lucide-react";
import type { AvailabilityFormState, OverrideRow } from "@/features/appointments/kimi/availability/types";

interface Props {
  overrides: OverrideRow[];
  form: AvailabilityFormState;
  onOverrideDateChange: (value: string) => void;
  onOverrideClosedChange: (value: boolean) => void;
  onOverrideOpenChange: (value: string) => void;
  onOverrideCloseChange: (value: string) => void;
  onAddOverride: () => void;
  onRemoveOverride: (date: string) => void;
}

export default function DateOverrides({
  overrides,
  form,
  onOverrideDateChange,
  onOverrideClosedChange,
  onOverrideOpenChange,
  onOverrideCloseChange,
  onAddOverride,
  onRemoveOverride,
}: Props) {
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
      </div>

      <div className="border-b border-[#f2f1f7] bg-[#faf9fd] px-[22px] py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-[#1c1a2e] mb-1.5">Date</label>
            <input
              type="date"
              className="avail-input text-[13px]"
              value={form.overrideDate}
              onChange={(e) => onOverrideDateChange(e.target.value)}
            />
          </div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#eceaf3] bg-white px-3 text-[13px]">
            <input
              type="checkbox"
              checked={form.overrideClosed}
              onChange={(e) => onOverrideClosedChange(e.target.checked)}
            />
            Closed all day
          </label>
          {!form.overrideClosed ? (
            <>
              <div>
                <label className="block text-[12px] font-semibold text-[#1c1a2e] mb-1.5">Open</label>
                <input
                  type="time"
                  className="avail-input text-[13px]"
                  value={form.overrideOpen}
                  onChange={(e) => onOverrideOpenChange(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#1c1a2e] mb-1.5">Close</label>
                <input
                  type="time"
                  className="avail-input text-[13px]"
                  value={form.overrideClose}
                  onChange={(e) => onOverrideCloseChange(e.target.value)}
                />
              </div>
            </>
          ) : null}
          <button
            type="button"
            className="avail-btn-ghost"
            disabled={!form.overrideDate}
            onClick={onAddOverride}
          >
            <Plus size={13} />
            Add override
          </button>
        </div>
      </div>

      <div className="px-[22px] pt-4 pb-2">
        {overrides.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[#8a87a0]">No date overrides yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-[220px_130px_190px_1fr_70px] gap-3 pb-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#8a87a0]">
              <span>Date</span>
              <span>Type</span>
              <span>Hours</span>
              <span>Note</span>
              <span />
            </div>

            {overrides.map((o) => (
              <div
                key={o.isoDate}
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
                  <button
                    type="button"
                    className="avail-icon-btn"
                    aria-label="Delete override"
                    onClick={() => onRemoveOverride(o.isoDate)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
