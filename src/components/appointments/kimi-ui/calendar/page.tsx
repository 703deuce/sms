"use client";

import React from "react";
import "./reference.css";
import CalendarHeader from "./components/CalendarHeader";
import StatCards from "./components/StatCards";
import WeekCalendar from "./components/WeekCalendar";
import MiniCalendar from "./components/MiniCalendar";
import DayAgenda from "./components/DayAgenda";
import NextAppointment from "./components/NextAppointment";

export default function CalendarPage() {
  return (
    <div className="cal-page">
      <CalendarHeader />
      <StatCards />
      <div className="cal-main">
        <WeekCalendar />
        <aside className="cal-side">
          <MiniCalendar />
          <DayAgenda />
          <NextAppointment />
        </aside>
      </div>
    </div>
  );
}
