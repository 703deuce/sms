"use client";

import React from "react";
import "./reference.css";
import CalendarHeader from "./components/CalendarHeader";
import CalendarFiltersPanel from "./components/CalendarFiltersPanel";
import StatCards from "./components/StatCards";
import WeekCalendar from "./components/WeekCalendar";
import DayCalendar from "./components/DayCalendar";
import StaffCalendar from "./components/StaffCalendar";
import MonthCalendar from "./components/MonthCalendar";
import MiniCalendar from "./components/MiniCalendar";
import DayAgenda from "./components/DayAgenda";
import NextAppointment from "./components/NextAppointment";
import type { CalendarPageActions, CalendarPageModel } from "@/features/appointments/kimi/calendar/types";

type Props = {
  model: CalendarPageModel;
  actions: CalendarPageActions;
  filtersOpen?: boolean;
  filterStaff?: Array<{ id: string; name: string; color?: string }>;
  filterTypes?: Array<{ id: string; name: string; color?: string }>;
  filterLocations?: Array<{ id: string; name: string }>;
  selectedStaffIds?: string[];
  selectedTypeIds?: string[];
  selectedLocationIds?: string[];
  selectedStatuses?: string[];
  onToggleStaffFilter?: (id: string) => void;
  onToggleTypeFilter?: (id: string) => void;
  onToggleLocationFilter?: (id: string) => void;
  onToggleStatusFilter?: (status: string) => void;
  onClearFilters?: () => void;
  onCloseFilters?: () => void;
};

export default function CalendarPage({
  model,
  actions,
  filtersOpen,
  filterStaff = [],
  filterTypes = [],
  filterLocations = [],
  selectedStaffIds = [],
  selectedTypeIds = [],
  selectedLocationIds = [],
  selectedStatuses = [],
  onToggleStaffFilter,
  onToggleTypeFilter,
  onToggleLocationFilter,
  onToggleStatusFilter,
  onClearFilters,
  onCloseFilters,
}: Props) {
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
        filterCount={actions.filterCount}
        onToggleFilters={actions.onToggleFilters}
        showAvailability={actions.showAvailability}
        onToggleAvailability={actions.onToggleAvailability}
      />
      <CalendarFiltersPanel
        open={Boolean(filtersOpen)}
        staff={filterStaff}
        bookingTypes={filterTypes}
        locations={filterLocations}
        selectedStaffIds={selectedStaffIds}
        selectedTypeIds={selectedTypeIds}
        selectedLocationIds={selectedLocationIds}
        selectedStatuses={selectedStatuses}
        onToggleStaff={onToggleStaffFilter || (() => undefined)}
        onToggleType={onToggleTypeFilter || (() => undefined)}
        onToggleLocation={onToggleLocationFilter || (() => undefined)}
        onToggleStatus={onToggleStatusFilter || (() => undefined)}
        onClearAll={onClearFilters || (() => undefined)}
        onClose={onCloseFilters || (() => undefined)}
      />
      <StatCards stats={model.stats} />
      <div className="cal-main">
        {model.view === "staff" ? (
          <StaffCalendar
            staffLanes={model.staffLanes}
            weekEvents={model.weekEvents}
            busyBlocks={model.busyBlocks}
            availabilityBands={model.availabilityBands}
            hours={model.hours}
            nowLine={model.nowLine}
            timezoneLabel={model.timezoneLabel}
            onOpenAppointment={actions.onOpenAppointment}
            onEventMove={actions.onEventMove}
            onSlotClick={actions.onSlotClick}
            dateKey={model.weekDays[0]?.dateKey || ""}
          />
        ) : model.view === "day" ? (
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
            busyBlocks={model.busyBlocks}
            availabilityBands={model.availabilityBands}
            hours={model.hours}
            typeColors={model.typeColors}
            nowLine={model.nowLine}
            timezoneLabel={model.timezoneLabel}
            onOpenAppointment={actions.onOpenAppointment}
            onShowCalendarSettings={actions.onShowCalendarSettings}
            onSlotClick={actions.onSlotClick}
            onEventMove={actions.onEventMove}
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
