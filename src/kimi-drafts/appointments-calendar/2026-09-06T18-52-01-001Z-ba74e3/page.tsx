"use client";
import React, { useState } from "react";
import "./reference.css";
import CalendarHeader from "./components/CalendarHeader";
import StatCards from "./components/StatCards";
import WeekCalendar from "./components/WeekCalendar";
import DayCalendar from "./components/DayCalendar";
import MonthCalendar from "./components/MonthCalendar";
import MiniCalendar from "./components/MiniCalendar";
import DayAgenda from "./components/DayAgenda";
import NextAppointment from "./components/NextAppointment";
import { HOURS, STATS, WEEK_DAYS, WEEK_EVENTS } from "./mock-data";

type View = "day" | "week" | "month";

export default function ReferencePage() {
  const [view, setView] = useState<View>("week");

  const rangeLabel =
    view === "day"
      ? "Wednesday, September 17, 2026"
      : view === "month"
        ? "September 2026"
        : "Sep 14 – Sep 20, 2026";

  const noop = () => {};
  const openAppointment = (id: string) => console.log("open", id);

  return (
    <div className="cal-page">
      <CalendarHeader
        rangeLabel={rangeLabel}
        view={view}
        onToday={noop}
        onPrev={noop}
        onNext={noop}
        onViewChange={setView}
        onNewAppointment={noop}
      />
      <StatCards stats={STATS} />
      <div className="cal-main">
        {view === "day" ? (
          <DayCalendar weekDays={WEEK_DAYS} weekEvents={WEEK_EVENTS} hours={HOURS} onOpenAppointment={openAppointment} onShowCalendarSettings={noop} />
        ) : view === "month" ? (
          <MonthCalendar onOpenAppointment={openAppointment} onSelectDay={noop} onShowCalendarSettings={noop} />
        ) : (
          <WeekCalendar weekDays={WEEK_DAYS} weekEvents={WEEK_EVENTS} hours={HOURS} onOpenAppointment={openAppointment} onShowCalendarSettings={noop} />
        )}
        <aside className="cal-side">
          <MiniCalendar onPrev={noop} onNext={noop} onSelectDay={noop} />
          <DayAgenda onOpenAppointment={openAppointment} onViewFullDay={() => setView("day")} />
          <NextAppointment onOpenAppointment={openAppointment} />
        </aside>
      </div>
    </div>
  );
}
