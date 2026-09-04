import React from "react";
import { Phone, Video, ArrowRight } from "lucide-react";
import { nextAppointment } from "../mock-data";

export default function NextAppointment() {
  const a = nextAppointment;
  return (
    <div className="next-card card">
      <div className="next-head">
        <span className="next-title">Next appointment</span>
        <span className="next-in">{a.inLabel}</span>
      </div>
      <div className="next-time">
        {a.time} <span className="next-dot-sep">•</span> {a.duration}
      </div>
      <div className="next-name-row">
        <div>
          <div className="next-appt-title">{a.title}</div>
          <div className="next-person">{a.name}</div>
        </div>
        <span className="badge badge-confirmed">Confirmed</span>
      </div>
      <div className="next-meta">
        <div className="next-meta-row">
          <Phone size={14} className="muted-icon" /> {a.method}
        </div>
        <div className="next-meta-row">{a.phone}</div>
        <div className="next-meta-row muted-row">
          <Video size={14} className="muted-icon" /> Add meeting notes...
        </div>
      </div>
      <button className="btn-primary full">
        View appointment <ArrowRight size={15} />
      </button>
    </div>
  );
}
