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
      action={
        <div className="flex items-center gap-2">
          <span className="ref-pill pill-purple">{total}</span>
          <button
            type="button"
            onClick={onViewCalendar}
            className="appt-pilot-muted-link flex items-center gap-1"
          >
            View calendar <ExternalLink size={13} aria-hidden />
          </button>
        </div>
      }
    >
      {schedule.length === 0 ? (
        <p className="appt-pilot-text-body py-8 text-center text-[var(--text-secondary)]">No appointments scheduled for today.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {schedule.map((a) => (
            <div
              key={a.id}
              className="flex cursor-pointer items-center gap-4 py-3"
              onClick={() => onOpenAppointment(a.id)}
            >
              <div className="w-[64px] shrink-0">
                <div className="appt-pilot-text-list font-semibold text-[var(--text-primary)]">{a.time}</div>
                <div className="appt-pilot-text-helper">{a.dur}</div>
              </div>
              <div className="w-[130px] shrink-0">
                <div className="appt-pilot-text-list flex items-center gap-1.5 font-medium text-gray-700">
                  <span className="appt-pilot-schedule-dot h-1.5 w-1.5 rounded-full" aria-hidden />
                  {a.type}
                </div>
                <div className="appt-pilot-text-helper pl-3">{a.loc}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="appt-pilot-text-list font-semibold text-[var(--text-primary)]">{a.name}</div>
                <div className="appt-pilot-text-helper">{a.phone}</div>
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
          className="appt-pilot-muted-link mt-1"
        >
          + {total - schedule.length} more appointments
        </button>
      ) : null}
    </RefDecoSection>
  );
}
