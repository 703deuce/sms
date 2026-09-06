import { ArrowRight, Clock, MapPin } from "lucide-react";
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
};

export default function TodaysSchedule({ schedule, total, onViewCalendar, onOpenAppointment }: Props) {
  return (
    <section className="ref-card">
      <div className="ref-card-h">
        <h2 className="ref-card-title">Today&apos;s schedule <span className="ml-1 text-[12px] font-medium text-gray-400">({total})</span></h2>
        <button className="ref-card-link flex items-center gap-1" onClick={onViewCalendar}>
          View calendar <ArrowRight size={13} />
        </button>
      </div>
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
            <div className="w-[150px] shrink-0">
              <div className="truncate text-[13px] font-medium text-gray-800">{a.name}</div>
              <div className="text-[11.5px] text-gray-400">{a.phone}</div>
            </div>
            <span className={`ref-chip ${chip(a.status)} shrink-0`}>{a.status}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
