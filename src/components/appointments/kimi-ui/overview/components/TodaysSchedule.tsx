import { ExternalLink, MoreVertical } from "lucide-react";
import type { OverviewScheduleItem } from "@/features/appointments/kimi/overview/types";
import { RefDecoSection } from "../../shared/ref-deco-patterns";

type Props = {
  schedule: OverviewScheduleItem[];
  total: number;
  onViewCalendar: () => void;
  onOpenAppointment: (id: string) => void;
};

export default function TodaysSchedule({ schedule, total, onViewCalendar, onOpenAppointment }: Props) {
  return (
    <RefDecoSection
      title="Today's schedule"
      tint="purple"
      action={
        <div className="flex items-center gap-2">
          <span className="ref-pill pill-purple">{total}</span>
          <button
            type="button"
            onClick={onViewCalendar}
            className="flex items-center gap-1 text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View calendar <ExternalLink size={13} aria-hidden />
          </button>
        </div>
      }
    >
      {schedule.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-gray-500">No appointments scheduled for today.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {schedule.map((a) => (
            <div
              key={a.id}
              className="flex cursor-pointer items-center gap-4 py-3"
              onClick={() => onOpenAppointment(a.id)}
            >
              <div className="w-[64px] shrink-0">
                <div className="text-[13px] font-semibold text-gray-900">{a.time}</div>
                <div className="text-[11px] text-gray-400">{a.dur}</div>
              </div>
              <div className="w-[130px] shrink-0">
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden />
                  {a.type}
                </div>
                <div className="pl-3 text-[11px] text-gray-400">{a.loc}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-gray-900">{a.name}</div>
                <div className="text-[11px] text-gray-400">{a.phone}</div>
              </div>
              <span className={`ref-pill ${a.status === "Confirmed" ? "pill-green" : "pill-amber"}`}>
                {a.status}
              </span>
              <button type="button" className="text-gray-300 hover:text-gray-500" aria-label="More actions">
                <MoreVertical size={16} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
      {total > schedule.length ? (
        <button
          type="button"
          onClick={onViewCalendar}
          className="mt-1 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700"
        >
          + {total - schedule.length} more appointments
        </button>
      ) : null}
    </RefDecoSection>
  );
}
