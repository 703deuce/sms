"use client";

import { useState } from "react";
import { Stethoscope, Ban, CalendarX2, Gauge, CalendarClock, Timer, CheckCircle2 } from "lucide-react";
import { DAY_LABELS, formatTime12h, type AvailabilityFormState } from "../mock-data";

type Reason = { icon: "closed" | "override" | "holiday" | "limit" | "notice" | "horizon" | "busy"; text: string };

const ICONS = {
  closed: Ban,
  override: CalendarX2,
  holiday: CalendarX2,
  limit: Gauge,
  notice: Timer,
  horizon: CalendarClock,
  busy: Ban,
};

export default function SlotDiagnostics({ form }: { form: AvailabilityFormState }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("14:00");
  const [checked, setChecked] = useState(false);
  const [reasons, setReasons] = useState<Reason[]>([]);

  const diagnose = () => {
    const out: Reason[] = [];
    if (!date) {
      setReasons(out);
      setChecked(true);
      return;
    }
    const d = new Date(`${date}T12:00:00`);
    const dayKey = DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1].key;
    const windows = form.weeklyHours[dayKey] || [];
    const override = form.dateOverrides.find((o) => o.date === date);
    const holiday = form.holidays.find((h) => h.date.slice(5) === date.slice(5) && h.closed);

    const now = new Date();
    const slotDate = new Date(`${date}T${time}:00`);
    const diffMin = (slotDate.getTime() - now.getTime()) / 60000;
    const diffDays = diffMin / 1440;

    if (override?.closed) out.push({ icon: "override", text: "Date override closes this entire day." });
    if (holiday) out.push({ icon: "holiday", text: `${holiday.name} — company holiday closes this date.` });
    if (!override?.closed && !holiday) {
      const activeWindows = override?.windows?.length ? override.windows : windows;
      const inWindow = activeWindows.some((w) => time >= w.open && time < w.close);
      if (!activeWindows.length) out.push({ icon: "closed", text: `No availability configured for ${DAY_LABELS.find((x) => x.key === dayKey)?.label}s.` });
      else if (!inWindow)
        out.push({
          icon: "closed",
          text: `Outside configured hours (${activeWindows.map((w) => `${formatTime12h(w.open)} – ${formatTime12h(w.close)}`).join(", ")}).`,
        });
    }
    if (diffMin >= 0 && diffMin < form.minimumNotice)
      out.push({ icon: "notice", text: `Inside minimum notice — bookings need at least ${form.minimumNotice} minutes of lead time.` });
    if (diffMin < 0) out.push({ icon: "notice", text: "This slot is in the past." });
    if (diffDays > form.maximumDays)
      out.push({ icon: "horizon", text: `Beyond booking horizon — customers can only book up to ${form.maximumDays} days ahead.` });
    if (form.maxPerDay > 0 && diffDays >= 0 && diffDays <= 1)
      out.push({ icon: "limit", text: `Daily limit reached — ${form.maxPerDay} of ${form.maxPerDay} appointments booked this day.` });
    if (out.length === 0 && time >= "13:00" && time < "14:00")
      out.push({ icon: "busy", text: "Blocked by Google Calendar — “Team standup”, 1:00 – 2:00 PM." });

    setReasons(out);
    setChecked(true);
  };

  return (
    <section className="avail-card avail-fade-in avail-fade-in-3">
      <div className="px-5 pt-5 pb-3 border-b border-[#f0eef6]">
        <h2 className="text-[13.5px] font-bold tracking-tight flex items-center gap-2">
          <Stethoscope size={14} className="text-[#5b45e0]" /> Slot diagnostics
        </h2>
        <p className="text-[11.5px] text-[#8a87a0] mt-1 leading-snug">
          Check why a specific slot is unavailable to customers.
        </p>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Diagnostic date"
            className="avail-time !w-[132px]"
            value={date}
            onChange={(e) => { setDate(e.target.value); setChecked(false); }}
          />
          <input
            type="time"
            aria-label="Diagnostic time"
            className="avail-time !w-[104px]"
            value={time}
            onChange={(e) => { setTime(e.target.value); setChecked(false); }}
          />
        </div>
        <button
          type="button"
          className="avail-btn-primary !h-[32px] !px-4 !text-[12.5px] w-full disabled:opacity-60"
          onClick={diagnose}
          disabled={!date}
        >
          Check slot
        </button>
        {checked && (
          <div aria-live="polite">
            {reasons.length === 0 ? (
              <div className="flex items-start gap-2.5 rounded-lg bg-[#e6f7ef] border border-[#cdeedd] px-3 py-2.5">
                <CheckCircle2 size={14} className="text-[#16a05a] mt-0.5 shrink-0" />
                <p className="text-[12px] font-medium text-[#127a48] leading-snug">
                  This slot is bookable. No rules block it.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {reasons.map((r, i) => {
                  const Icon = ICONS[r.icon];
                  return (
                    <li key={i} className="flex items-start gap-2.5 rounded-lg bg-[#fdf6ec] border border-[#f3e3c8] px-3 py-2.5">
                      <Icon size={13.5} className="text-[#c46a1b] mt-0.5 shrink-0" />
                      <p className="text-[12px] font-medium text-[#8a5416] leading-snug">{r.text}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
