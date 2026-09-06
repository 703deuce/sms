"use client";
import React, { useCallback, useEffect, useState } from "react";
import "./reference.css";
import { AlertTriangle, CalendarPlus } from "lucide-react";
import CalendarHeader from "./components/CalendarHeader";
import StatCards from "./components/StatCards";
import WeekCalendar from "./components/WeekCalendar";
import DayCalendar from "./components/DayCalendar";
import MonthCalendar from "./components/MonthCalendar";
import MiniCalendar from "./components/MiniCalendar";
import DayAgenda from "./components/DayAgenda";
import NextAppointment from "./components/NextAppointment";
import AppointmentPopover from "./components/AppointmentPopover";
import NewAppointmentDrawer from "./components/NewAppointmentDrawer";
import CalendarSettingsModal from "./components/CalendarSettingsModal";
import { HOURS, STATS, WEEK_DAYS, WEEK_EVENTS, type CalEvent } from "./mock-data";

type View = "day" | "week" | "month";
type LoadState = "loading" | "ready" | "error";

export default function ReferencePage() {
  const [view, setView] = useState<View>("week");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [drawer, setDrawer] = useState<{ open: boolean; dayLabel?: string; timeLabel?: string }>({ open: false });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoadState("ready"), 700);
    return () => clearTimeout(t);
  }, []);

  const retry = useCallback(() => {
    setLoadState("loading");
    setTimeout(() => setLoadState("ready"), 700);
  }, []);

  const rangeLabel =
    view === "day"
      ? "Wednesday, September 17, 2026"
      : view === "month"
        ? "September 2026"
        : "Sep 14 – Sep 20, 2026";

  const noop = () => {};
  const openAppointment = (id: string) => {
    const ev = WEEK_EVENTS.find((e) => e.id === id) || null;
    setSelectedEvent(ev);
  };
  const openNew = (prefill?: { dayLabel: string; timeLabel: string }) =>
    setDrawer({ open: true, ...prefill });
  const onSlotClick = (dayIndex: number, hour: number) => {
    const d = WEEK_DAYS[dayIndex];
    const hr = hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`;
    openNew({ dayLabel: `${d.label}, Sep ${d.date}`, timeLabel: hr });
  };

  if (loadState === "error") {
    return (
      <div className="cal-page flex min-h-screen items-center justify-center">
        <div className="card max-w-md px-6 py-12 text-center">
          <div className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">We couldn&apos;t load your calendar</h3>
          <p className="mt-1.5 text-[13px] text-gray-500">Something went wrong while fetching appointments for this range.</p>
          <button onClick={retry} className="mt-5 inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div className="cal-page animate-pulse">
        <div className="mb-4 h-10 w-72 rounded-lg bg-gray-200" />
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="stat-card h-[104px] bg-gray-100" />
          ))}
        </div>
        <div className="cal-main">
          <div className="week-card card h-[640px] bg-gray-100" />
          <div className="cal-side">
            <div className="card h-56 bg-gray-100" />
            <div className="card h-72 bg-gray-100" />
            <div className="card h-64 bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  const hasEvents = WEEK_EVENTS.length > 0;

  return (
    <div className="cal-page">
      <CalendarHeader
        rangeLabel={rangeLabel}
        view={view}
        onToday={noop}
        onPrev={noop}
        onNext={noop}
        onViewChange={setView}
        onNewAppointment={() => openNew()}
      />
      <StatCards stats={STATS} />
      {hasEvents ? (
        <div className="cal-main">
          {view === "day" ? (
            <DayCalendar weekDays={WEEK_DAYS} weekEvents={WEEK_EVENTS} hours={HOURS} onOpenAppointment={openAppointment} onSlotClick={onSlotClick} onShowCalendarSettings={() => setSettingsOpen(true)} />
          ) : view === "month" ? (
            <MonthCalendar onOpenAppointment={openAppointment} onSelectDay={noop} onNewForDay={(day) => openNew({ dayLabel: `Sep ${day}`, timeLabel: "9 AM" })} onShowCalendarSettings={() => setSettingsOpen(true)} />
          ) : (
            <WeekCalendar weekDays={WEEK_DAYS} weekEvents={WEEK_EVENTS} hours={HOURS} onOpenAppointment={openAppointment} onSlotClick={onSlotClick} onShowCalendarSettings={() => setSettingsOpen(true)} />
          )}
          <aside className="cal-side">
            <MiniCalendar onPrev={noop} onNext={noop} onSelectDay={noop} />
            <DayAgenda onOpenAppointment={openAppointment} onViewFullDay={() => setView("day")} />
            <NextAppointment onOpenAppointment={openAppointment} />
          </aside>
        </div>
      ) : (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <CalendarPlus className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">No appointments this {view}</h3>
          <p className="mt-1.5 max-w-sm text-[13px] text-gray-500">
            Appointments appear here when customers book or you add one manually. Click any empty time slot to get started.
          </p>
          <button onClick={() => openNew()} className="mt-5 inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500">
            New appointment
          </button>
        </div>
      )}

      {selectedEvent && (
        <AppointmentPopover
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onOpenDetail={() => setSelectedEvent(null)}
        />
      )}
      <NewAppointmentDrawer
        open={drawer.open}
        dayLabel={drawer.dayLabel}
        timeLabel={drawer.timeLabel}
        onClose={() => setDrawer({ open: false })}
        onSave={() => setDrawer({ open: false })}
      />
      <CalendarSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
