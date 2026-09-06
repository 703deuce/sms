"use client";

import React from "react";
import "./reference.css";
import CalendarHeader from "./components/CalendarHeader";
import StatCards from "./components/StatCards";
import WeekCalendar from "./components/WeekCalendar";
import DayCalendar from "./components/DayCalendar";
import MonthCalendar from "./components/MonthCalendar";
import MiniCalendar from "./components/MiniCalendar";
import DayAgenda from "./components/DayAgenda";
import NextAppointment from "./components/NextAppointment";
import type { CalendarPageActions, CalendarPageModel } from "@/features/appointments/kimi/calendar/types";

type Props = {
  model: CalendarPageModel;
  actions: CalendarPageActions;
};

export default function CalendarPage({ model, actions }: Props) {
  return (
    <div className="cal-page">
      <CalendarHeader
        rangeLabel={model.rangeLabel}
        view={model.view}
        onToday={actions.onToday}
        onPrev={actions.onPrev}
        onNext={actions.onNext}
        onViewChange={actions.onViewChange}
        onNewAppointment={actions.onNewAppointment}
      />
      <StatCards stats={model.stats} />
      <div className="cal-main">
        {model.view === "day" ? (
          <DayCalendar
            weekDays={model.weekDays}
            weekEvents={model.weekEvents}
            hours={model.hours}
            typeColors={model.typeColors}
            nowLine={model.nowLine}
            timezoneLabel={model.timezoneLabel}
            onOpenAppointment={actions.onOpenAppointment}
            onShowCalendarSettings={actions.onShowCalendarSettings}
          />
        ) : model.view === "month" ? (
          <MonthCalendar
            monthDays={model.monthDays}
            typeColors={model.typeColors}
            onOpenAppointment={actions.onOpenAppointment}
            onSelectDay={actions.onSelectDay}
            onShowCalendarSettings={actions.onShowCalendarSettings}
          />
        ) : (
          <WeekCalendar
            weekDays={model.weekDays}
            weekEvents={model.weekEvents}
            hours={model.hours}
            typeColors={model.typeColors}
            nowLine={model.nowLine}
            timezoneLabel={model.timezoneLabel}
            onOpenAppointment={actions.onOpenAppointment}
            onShowCalendarSettings={actions.onShowCalendarSettings}
          />
        )}
        <aside className="cal-side">
          <MiniCalendar
            monthLabel={model.miniCalendar.monthLabel}
            days={model.miniCalendar.days}
            onPrev={actions.onMiniCalendarPrev}
            onNext={actions.onMiniCalendarNext}
            onSelectDay={actions.onSelectDay}
          />
          <DayAgenda
            dateLabel={model.agenda.dateLabel}
            count={model.agenda.count}
            items={model.agenda.items}
            onOpenAppointment={actions.onOpenAppointment}
            onViewFullDay={actions.onViewFullDay}
          />
          {model.nextAppointment ? (
            <NextAppointment
              appointment={model.nextAppointment}
              onOpenAppointment={actions.onOpenAppointment}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
