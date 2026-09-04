import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { miniCal } from "../mock-data";

export default function MiniCalendar() {
  return (
    <div className="mini-cal card">
      <div className="mini-head">
        <span className="mini-month">August 2026</span>
        <div className="mini-nav">
          <button className="icon-btn sm"><ChevronLeft size={14} /></button>
          <button className="icon-btn sm"><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="mini-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="mini-dow">{d}</span>
        ))}
        {miniCal.map((cell, i) => (
          <span
            key={i}
            className={`mini-day ${cell.muted ? "muted" : ""} ${cell.selected ? "selected" : ""} ${cell.hasEvent ? "has-event" : ""}`}
          >
            {cell.day}
          </span>
        ))}
      </div>
    </div>
  );
}
