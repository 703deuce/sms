import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { formatDay, formatTime, type AppointmentRow } from "../mock-data";

const TIMES = ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM"];

function nextDays(n: number) {
  const out: Date[] = [];
  const d = new Date();
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0) out.push(new Date(d)); // skip Sundays
  }
  return out;
}

export function RescheduleModal({
  row,
  onClose,
  onRescheduled,
}: {
  row: AppointmentRow | null;
  onClose: () => void;
  onRescheduled: (id: string, iso: string) => void;
}) {
  const days = useMemo(() => nextDays(7), []);
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!row) return null;

  const save = () => {
    if (!slot) return;
    setSaving(true);
    setTimeout(() => {
      const d = new Date(days[dayIdx]);
      const [time, mer] = slot.split(" ");
      let [h, m] = time.split(":").map(Number);
      if (mer === "PM" && h !== 12) h += 12;
      if (mer === "AM" && h === 12) h = 0;
      d.setHours(h, m, 0, 0);
      onRescheduled(row.id, d.toISOString());
      setSaving(false);
      setSlot(null);
      onClose();
    }, 500);
  };

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title={`Reschedule — ${row.inviteeName ?? "appointment"}`}
      description={`Currently ${formatDay(row.startsAt, row.timezone)} at ${formatTime(row.startsAt, row.timezone)}. Pending reminders are recalculated and the customer receives an updated confirmation.`}
      wide
      footer={
        <>
          <button type="button" className="tv-btn tv-btn--ghost" onClick={onClose}>Keep current time</button>
          <button type="button" className="tv-btn tv-btn--primary" disabled={!slot || saving} onClick={save}>
            {saving ? "Rescheduling…" : "Confirm new time"}
          </button>
        </>
      }
    >
      <div className="tv-fieldlabel" style={{ marginBottom: 8 }}>Choose a day</div>
      <div className="tv-daypicker" role="listbox" aria-label="Available days">
        {days.map((d, i) => (
          <button
            key={d.toDateString()}
            type="button"
            role="option"
            aria-selected={dayIdx === i}
            className={dayIdx === i ? "tv-daypill tv-daypill--active" : "tv-daypill"}
            onClick={() => { setDayIdx(i); setSlot(null); }}
          >
            <span className="tv-daypill__dow">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
            <span className="tv-daypill__num">{d.getDate()}</span>
          </button>
        ))}
      </div>
      <div className="tv-fieldlabel" style={{ margin: "16px 0 8px" }}>
        Available times — {days[dayIdx].toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} (Eastern)
      </div>
      <div className="tv-slotgrid" role="listbox" aria-label="Available times">
        {TIMES.map((t) => (
          <button
            key={t}
            type="button"
            role="option"
            aria-selected={slot === t}
            className={slot === t ? "tv-slot tv-slot--active" : "tv-slot"}
            onClick={() => setSlot(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="tv-modalnote">
        Rescheduling cancels the old reminder jobs, updates the calendar event, and sends the customer an updated confirmation with the new time.
      </p>
    </Modal>
  );
}
