import React from "react";
import { Phone, Video, ArrowRight } from "lucide-react";
import { CalendarMeetingBadges } from "@/components/appointments/kimi-ui/calendar/meeting-badges";
import type { CalendarNextAppointment } from "@/features/appointments/kimi/calendar/types";

type Props = {
  appointment: CalendarNextAppointment;
  onOpenAppointment: (id: string) => void;
};

function statusLabel(status: string) {
  if (status === "confirmed") return "Confirmed";
  if (status === "pending") return "Pending";
  return "Canceled";
}

export default function NextAppointment({ appointment: a, onOpenAppointment }: Props) {
  return (
    <div className="next-card card">
      <div className="next-head">
        <span className="next-title">Next appointment</span>
        <span className="next-in">{a.inLabel}</span>
      </div>
      <div className="next-time">
        {a.time} <span className="next-dot-sep" aria-hidden>•</span> {a.duration}
      </div>
      <div className="next-name-row">
        <div>
          <div className="next-appt-title">{a.title}</div>
          <div className="next-person">{a.name}</div>
        </div>
        <span className={`badge badge-${a.status}`}>{statusLabel(a.status)}</span>
      </div>
      <div className="next-meta">
        <div className="next-meta-row">
          <Phone size={14} className="muted-icon" aria-hidden />
          <span>{a.method}</span>
        </div>
        <div className="next-meta-row next-phone-row">
          <span className="next-phone-spacer" aria-hidden />
          <span>{a.phone}</span>
        </div>
        <div className="next-meta-row muted-row">
          <Video size={14} className="muted-icon" aria-hidden />
          <CalendarMeetingBadges
            meeting={a.meeting}
            appointmentId={a.id}
            eventKind={a.eventKind}
          />
        </div>
      </div>
      <button type="button" className="btn-primary full" onClick={() => onOpenAppointment(a.id)}>
        {a.eventKind === "appointment" ? "View appointment" : "Open meeting"} <ArrowRight size={15} />
      </button>
    </div>
  );
}
