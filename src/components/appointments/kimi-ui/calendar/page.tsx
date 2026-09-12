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
  headerView?: CalendarPageModel["view"] | "agenda";
  hideStatCards?: boolean;
  sideCollapsed?: boolean;
  onToggleSide?: () => void;
};

export default function CalendarPage({ model, actions, headerView, hideStatCards, sideCollapsed, onToggleSide }: Props) {
  const activeView = (headerView || model.view) as CalendarPageModel["view"] | "agenda";
  return (
    <div className="cal-page">
      <CalendarHeader
        rangeLabel={model.rangeLabel}
        view={activeView}
        onToday={actions.onToday}
        onPrev={actions.onPrev}
        onNext={actions.onNext}
        onViewChange={actions.onViewChange}
        onNewAppointment={actions.onNewAppointment}
        onBlockTime={actions.onBlockTime}
        onWaitlist={actions.onWaitlist}
        sideCollapsed={sideCollapsed}
        onToggleSide={onToggleSide}
        hideTitleBlock
      />
      {!hideStatCards ? <StatCards stats={model.stats} /> : (
        <div className="cal-summary-strip">
          <span><strong>{model.stats[0]?.value || 0}</strong> in range</span>
          <span><strong>{model.stats[1]?.value || 0}</strong> confirmed</span>
          <span><strong>{model.stats[2]?.value || 0}</strong> pending</span>
        </div>
      )}
      <div className={`cal-main ${sideCollapsed ? "cal-main--side-collapsed" : ""}`}>
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
            onSlotClick={actions.onSlotClick}
            timeZone={actions.timeZone}
            dragOverrides={actions.dragOverrides}
            onDragPreview={actions.onDragPreview}
            onDragClear={actions.onDragClear}
            onDragCommit={actions.onDragCommit}
            slotWaitlistCounts={actions.slotWaitlistCounts}
            onWaitlistSlotClick={actions.onWaitlistSlotClick}
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
            onSlotClick={actions.onSlotClick}
            timeZone={actions.timeZone}
            dragOverrides={actions.dragOverrides}
            onDragPreview={actions.onDragPreview}
            onDragClear={actions.onDragClear}
            onDragCommit={actions.onDragCommit}
            slotWaitlistCounts={actions.slotWaitlistCounts}
            onWaitlistSlotClick={actions.onWaitlistSlotClick}
          />
        )}
        <aside className={`cal-side ${sideCollapsed ? "cal-side--collapsed" : ""}`}>
          {!sideCollapsed ? (
            <>
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
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
