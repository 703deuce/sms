"use client";

import {
  CALENDAR_EVENTS,
  CALENDAR_STATS,
  CALENDAR_WEEK_START,
  TODAY_AGENDA,
  type CalendarEvent,
} from "@/lib/realtor/appointments-crm-mock";
import { cn } from "@/lib/utils";
import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subWeeks,
} from "date-fns";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  Home,
  Phone,
  Plus,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

const HOUR_START = 8;
const HOUR_END = 19;
const HOUR_HEIGHT = 64;
const TOTAL_HOURS = HOUR_END - HOUR_START;

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}:00 ${period}` : `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

function eventStyle(event: CalendarEvent) {
  const top = ((event.startMinutes - HOUR_START * 60) / 60) * HOUR_HEIGHT;
  const height = ((event.endMinutes - event.startMinutes) / 60) * HOUR_HEIGHT;
  return { top: `${top}px`, height: `${Math.max(height, 28)}px` };
}

function AgendaIcon({ type }: { type: (typeof TODAY_AGENDA)[number]["icon"] }) {
  const cls = "h-3.5 w-3.5 text-[#6b7280]";
  if (type === "phone") return <Phone className={cls} />;
  if (type === "home") return <Home className={cls} />;
  if (type === "file") return <FileText className={cls} />;
  return <User className={cls} />;
}

export function CalendarView() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(CALENDAR_WEEK_START, { weekStartsOn: 0 }),
  );
  const [miniMonth, setMiniMonth] = useState(() => startOfMonth(CALENDAR_WEEK_START));
  const [selectedDay, setSelectedDay] = useState(() => addDays(CALENDAR_WEEK_START, 1));

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const weekEnd = weekDays[6];
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i);

  const miniDays = useMemo(() => {
    const monthStart = startOfMonth(miniMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(addDays(startOfMonth(addDays(miniMonth, 35)), -1), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [miniMonth]);

  const goToday = () => {
    const today = new Date();
    setWeekStart(startOfWeek(today, { weekStartsOn: 0 }));
    setMiniMonth(startOfMonth(today));
    setSelectedDay(today);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Calendar</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">
            View and manage all your appointments and availability.
          </p>
        </div>
        <button type="button" className="realtor-btn-primary bg-[#7c3aed] hover:bg-[#6d28d9]">
          <Plus className="h-4 w-4" />
          New Appointment
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="realtor-card flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekStart((d) => subWeeks(d, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] hover:bg-[#f9fafb]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-[13px] font-semibold hover:bg-[#f9fafb]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setWeekStart((d) => addWeeks(d, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] hover:bg-[#f9fafb]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="ml-2 text-[15px] font-semibold text-[#111827]">
                {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="realtor-btn-outline text-[13px]">
                <Filter className="h-4 w-4" />
                Filter
              </button>
              <button type="button" className="realtor-btn-outline text-[13px]">Week</button>
            </div>
          </div>

          <div className="realtor-card overflow-hidden">
            <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[#e5e7eb] bg-[#fafbfc]">
              <div />
              {weekDays.map((day) => {
                const selected = isSameDay(day, selectedDay);
                const today = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "border-l border-[#e5e7eb] px-2 py-3 text-center transition",
                      selected && "bg-purple-50",
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase text-[#6b7280]">{format(day, "EEE")}</p>
                    <p
                      className={cn(
                        "mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold",
                        today && "bg-[#7c3aed] text-white",
                        selected && !today && "bg-[#7c3aed]/10 text-[#7c3aed]",
                        !today && !selected && "text-[#111827]",
                      )}
                    >
                      {format(day, "d")}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-[56px_repeat(7,1fr)]">
              <div className="relative border-r border-[#e5e7eb] bg-[#fafbfc]">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="flex items-start justify-end border-b border-[#f0f1f4] pr-2 pt-1 text-[11px] text-[#9ca3af]"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    {hour <= 12 ? `${hour === 12 ? 12 : hour}:00 ${hour < 12 ? "AM" : "PM"}` : `${hour - 12}:00 PM`}
                  </div>
                ))}
              </div>

              {weekDays.map((day, dayIndex) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "relative border-l border-[#e5e7eb]",
                    isSameDay(day, selectedDay) && "bg-purple-50/30",
                  )}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-[#f0f1f4]"
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}
                  {CALENDAR_EVENTS.filter((e) => e.dayIndex === dayIndex).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={cn(
                        "absolute left-1 right-1 overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left shadow-sm transition hover:brightness-95",
                        event.color,
                        event.borderColor,
                      )}
                      style={eventStyle(event)}
                    >
                      <p className="truncate text-[11px] font-bold text-[#111827]">
                        {formatTime(event.startMinutes)}
                      </p>
                      <p className="truncate text-[12px] font-semibold text-[#111827]">{event.title}</p>
                      <p className="truncate text-[11px] text-[#6b7280]">{event.contact}</p>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="realtor-card grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
            {[
              { label: "Appointments This Week", value: CALENDAR_STATS.appointments, icon: Calendar, tone: "text-purple-600" },
              { label: `Confirmed (${CALENDAR_STATS.confirmedPct}%)`, value: CALENDAR_STATS.confirmed, icon: CheckCircle2, tone: "text-emerald-600" },
              { label: "Avg. Duration", value: CALENDAR_STATS.avgDuration, icon: Clock, tone: "text-blue-600" },
              { label: "Clients This Week", value: CALENDAR_STATS.clients, icon: Users, tone: "text-orange-600" },
              { label: "vs Last Week", value: `+${CALENDAR_STATS.growth}`, icon: TrendingUp, tone: "text-emerald-600" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <stat.icon className={cn("h-5 w-5 shrink-0", stat.tone)} />
                <div>
                  <p className="text-[18px] font-bold text-[#111827]">{stat.value}</p>
                  <p className="text-[11px] text-[#6b7280]">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="realtor-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMiniMonth((m) => addDays(startOfMonth(m), -1))}
                className="text-[#6b7280] hover:text-[#111827]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[14px] font-semibold">{format(miniMonth, "MMMM yyyy")}</span>
              <button
                type="button"
                onClick={() => setMiniMonth((m) => addDays(startOfMonth(addDays(m, 32)), 0))}
                className="text-[#6b7280] hover:text-[#111827]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#9ca3af]">
              {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {miniDays.map((day) => {
                const inMonth = isSameMonth(day, miniMonth);
                const selected = isSameDay(day, selectedDay);
                const today = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      setSelectedDay(day);
                      setWeekStart(startOfWeek(day, { weekStartsOn: 0 }));
                    }}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-[11px] transition",
                      !inMonth && "text-[#d1d5db]",
                      inMonth && !selected && !today && "text-[#374151] hover:bg-[#f3f4f6]",
                      selected && "bg-[#7c3aed] font-semibold text-white",
                      today && !selected && "font-bold text-[#7c3aed]",
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="realtor-card p-4">
            <h3 className="font-semibold text-[#111827]">
              Today · {format(selectedDay, "EEE, MMM d")}
            </h3>
            <p className="text-[12px] text-[#6b7280]">{TODAY_AGENDA.length} appointments</p>
            <ul className="mt-4 space-y-3">
              {TODAY_AGENDA.map((item) => (
                <li key={item.time + item.title} className="flex items-start gap-3 rounded-lg border border-[#e5e7eb] p-3">
                  <div className="min-w-[52px] text-[12px] font-semibold text-[#7c3aed]">{item.time}</div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-[#111827]">{item.title}</p>
                    <p className="text-[12px] text-[#6b7280]">{item.contact}</p>
                  </div>
                  <AgendaIcon type={item.icon} />
                </li>
              ))}
            </ul>
            <button type="button" className="mt-4 w-full text-[13px] font-semibold text-[#7c3aed]">
              View Full Agenda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
