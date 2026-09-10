import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { formatDay, formatTime, type AppointmentRow } from "../list-types";

export function RescheduleModal({
  row,
  onClose,
  onRescheduled,
}: {
  row: AppointmentRow | null;
  onClose: () => void;
  onRescheduled: (id: string, iso: string) => void | Promise<void>;
}) {
  const [slots, setSlots] = useState<Array<{ startsAt: string; endsAt?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row?.serviceName) {
      setSlots([]);
      return;
    }
    setLoading(true);
    setSelected(null);
    fetch(
      `/api/appointments/availability?serviceName=${encodeURIComponent(row.serviceName)}&daysAhead=14`,
    )
      .then((r) => r.json())
      .then((json) => setSlots(json.data?.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [row?.id, row?.serviceName]);

  const grouped = useMemo(() => {
    const map = new Map<string, Array<{ startsAt: string; endsAt?: string }>>();
    for (const slot of slots) {
      const key = new Date(slot.startsAt).toDateString();
      const list = map.get(key) || [];
      list.push(slot);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [slots]);

  if (!row) return null;

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onRescheduled(row.id, selected);
      setSelected(null);
      onClose();
    } finally {
      setSaving(false);
    }
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
          <button type="button" className="tv-btn tv-btn--primary" disabled={!selected || saving} onClick={save}>
            {saving ? "Rescheduling…" : "Confirm new time"}
          </button>
        </>
      }
    >
      {loading ? (
        <p className="tv-muted">Loading available times…</p>
      ) : grouped.length === 0 ? (
        <p className="tv-muted">No available times found for this booking type in the next 14 days.</p>
      ) : (
        <div className="tv-stack" style={{ gap: 16 }}>
          {grouped.map(([dayKey, daySlots]) => (
            <div key={dayKey}>
              <div className="tv-fieldlabel" style={{ marginBottom: 8 }}>
                {formatDay(daySlots[0]!.startsAt, row.timezone)}
              </div>
              <div className="tv-slotgrid">
                {daySlots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    className={selected === slot.startsAt ? "tv-slot tv-slot--active" : "tv-slot"}
                    onClick={() => setSelected(slot.startsAt)}
                  >
                    {formatTime(slot.startsAt, row.timezone)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
