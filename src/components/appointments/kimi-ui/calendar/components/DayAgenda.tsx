import React from "react";
import { MoreVertical, ArrowRight } from "lucide-react";
import { agenda } from "../mock-data";

export default function DayAgenda() {
  return (
    <div className="agenda card">
      <div className="agenda-head">
        <span className="agenda-date">Friday, September 4, 2026</span>
        <span className="agenda-count">4 appointments</span>
      </div>
      <div className="agenda-list">
        {agenda.map((a) => (
          <div key={a.id} className="agenda-item">
            <div className="agenda-left">
              <span className="agenda-dot" style={{ background: a.dot }} />
              <div>
                <div className="agenda-time">{a.time}</div>
                <div className="agenda-dur">{a.duration}</div>
              </div>
            </div>
            <div className="agenda-mid">
              <div className="agenda-title">{a.title}</div>
              <div className="agenda-name">{a.name}</div>
            </div>
            <span className={`badge badge-${a.status}`}>
              {a.status === "confirmed" ? "Confirmed" : a.status === "pending" ? "Pending" : "Canceled"}
            </span>
            <button className="icon-btn sm"><MoreVertical size={15} /></button>
          </div>
        ))}
      </div>
      <button className="link-btn">
        View full day <ArrowRight size={14} />
      </button>
    </div>
  );
}
