import { ArrowRight, CalendarPlus, CalendarX2, Clock, MapPin } from "lucide-react";
import type { ScheduleItem } from "../mock-data";

function chip(status: string) {
  if (status === "Confirmed") return "ref-chip-green";
  if (status === "Awaiting confirmation") return "ref-chip-amber";
  if (status === "Reschedule requested") return "ref-chip-purple";
  return "ref-chip-gray";
}

type Props = {
  schedule: ScheduleItem[];
  total: number;
  onViewCalendar: () => void;
  onOpenAppointment: (id: string) => void;
  onNewAppointment: () => void;
};

export default function TodaysSchedule({ schedule, total, onViewCalendar, onOpenAppointment, onNewAppointment }: Props) {
  return (
    <section className="ref-card">
      <div className="ref-card-h">
        <h2 className="ref-card-title">Today&apos;s schedule <span className="ml-1 text-[12px] font-medium text-gray-400">({total})</span></h2>
        <button className="ref-card-link flex items-center gap-1" onClick={onViewCalendar}>
          View calendar <ArrowRight size={13} />
        </button>
      </div>
      {schedule.length === 0 ? (
        <div className="ref-empty">
          <span className="ref-tint-purple flex h-11 w-11 items-center justify-center rounded-xl">
            <CalendarX2 size={18} />
          </span>
          <h3 className="mt-3 text-[13.5px] font-semibold text-gray-900">No appointments today</h3>
          <p className="mt-1 max-w-[260px] text-[12.5px] text-gray-500">
            Your schedule is clear. New bookings will appear here, or add one manually.
          </p>
          <div className="mt-4 flex items-center gap-2.5">
            <button
              onClick={onNewAppointment}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <CalendarPlus size={14} /> New appointment
            </button>
            <button
              onClick={onViewCalendar}
              className="inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              Open calendar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 divide-y divide-gray-100 pb-2">
          {schedule.map((a) => (
            <button
              key={a.id}
              onClick={() => onOpenAppointment(a.id)}
              className="ref-row-hover flex w-full items-center gap-3.5 px-[18px] py-3 text-left"
            >
              <div className="w-[86px] shrink-0">
                <div className="text-[13px] font-semibold text-gray-900">{a.time}</div>
                <div className="flex items-center gap-1 text-[11px] text-gray-400"><Clock size={10} />{a.dur}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-gray-900">{a.type}</div>
                <div className="flex items-center gap-1 text-[12px] text-gray-500">
                  <MapPin size={11} className="shrink-0" />{a.loc}
                </div>
              </div>
              <div className="hidden w-[150px] shrink-0 sm:block">
                <div className="truncate text-[13px] font-medium text-gray-800">{a.name}</div>
                <div className="text-[11.5px] text-gray-400">{a.phone}</div>
              </div>
              <span className={`ref-chip ${chip(a.status)} shrink-0`}>{a.status}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
