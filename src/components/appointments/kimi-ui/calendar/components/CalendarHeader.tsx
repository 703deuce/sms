import React from "react";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, Plus } from "lucide-react";

export default function CalendarHeader() {
  return (
    <div className="cal-header">
      <div className="cal-title-wrap">
        <Calendar size={22} className="cal-title-icon" />
        <div>
          <h1 className="cal-title">Calendar</h1>
          <p className="cal-subtitle">Manage your appointments and schedule.</p>
        </div>
      </div>
      <div className="cal-controls">
        <button className="btn-today">Today</button>
        <div className="nav-arrows">
          <button className="icon-btn"><ChevronLeft size={16} /></button>
          <button className="icon-btn"><ChevronRight size={16} /></button>
        </div>
        <button className="btn-range">
          Aug 30 – Sep 5, 2026 <ChevronDown size={14} />
        </button>
        <div className="view-toggle">
          <button className="vt-btn">Day</button>
          <button className="vt-btn active">Week</button>
          <button className="vt-btn">Month</button>
        </div>
        <button className="btn-primary">
          <Plus size={16} /> New appointment
        </button>
      </div>
    </div>
  );
}
