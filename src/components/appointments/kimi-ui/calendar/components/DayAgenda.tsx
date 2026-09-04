import React from "react";
import { MoreVertical, ArrowRight } from "lucide-react";
import type { CalendarAgendaItem } from "@/features/appointments/kimi/calendar/types";

type Props = {
  dateLabel: string;
  count: number;
  items: CalendarAgendaItem[];
  onOpenAppointment: (id: string) => void;
  onViewFullDay: () => void;
};

function statusLabel(status: string) {
  if (status === "confirmed") return "Confirmed";
  if (status === "pending") return "Pending";
  return "Canceled";
}

export default function DayAgenda({
  dateLabel,
  count,
  items,
  onOpenAppointment,
  onViewFullDay,
}: Props) {
  return (
    <div className="agenda card">
      <div className="agenda-head">
        <span className="agenda-date">{dateLabel}</span>
        <span className="agenda-count">
          {count} appointment{count === 1 ? "" : "s"}
        </span>
      </div>
      <div className="agenda-list">
        {items.length === 0 ? (
          <p className="text-[12px] text-[var(--muted)] py-2">No appointments on this day.</p>
        ) : (
          items.map((a) => (
            <button
              key={a.id}
              type="button"
              className="agenda-item w-full text-left"
              onClick={() => onOpenAppointment(a.id)}
            >
              <div className="agenda-left">
                <span className="agenda-dot" style={{ background: a.dot }} aria-hidden />
                <div>
                  <div className="agenda-time">{a.time}</div>
                  <div className="agenda-dur">{a.duration}</div>
                </div>
              </div>
              <div className="agenda-mid">
                <div className="agenda-title">{a.title}</div>
                <div className="agenda-name">{a.name}</div>
              </div>
              <span className={`badge badge-${a.status}`}>{statusLabel(a.status)}</span>
              <span className="icon-btn sm agenda-kebab" aria-hidden>
                <MoreVertical size={15} />
              </span>
            </button>
          ))
        )}
      </div>
      <button type="button" className="link-btn" onClick={onViewFullDay}>
        View full day <ArrowRight size={14} />
      </button>
    </div>
  );
}
