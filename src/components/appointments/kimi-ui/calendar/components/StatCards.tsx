import React from "react";
import { Calendar, CheckCircle2, Clock, XCircle, Users, TrendingUp } from "lucide-react";
import { stats } from "../mock-data";

const icons: Record<string, React.ReactNode> = {
  calendar: <Calendar size={20} />,
  check: <CheckCircle2 size={20} />,
  clock: <Clock size={20} />,
  x: <XCircle size={20} />,
  users: <Users size={20} />,
};

export default function StatCards() {
  return (
    <div className="stat-row">
      {stats.map((s) => (
        <div key={s.label} className="stat-card">
          <div className={`stat-icon stat-icon-${s.tone}`}>{icons[s.icon]}</div>
          <div className="stat-body">
            <div className="stat-top">
              <span className="stat-value">{s.value}</span>
            </div>
            <div className="stat-label">{s.label}</div>
            {s.delta && (
              <div className={`stat-delta ${s.deltaUp ? "up" : "neutral"}`}>
                {s.deltaUp && <TrendingUp size={12} />} {s.delta}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
