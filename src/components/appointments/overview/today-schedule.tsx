import { AppointmentStatusBadge, formatAppointmentTime } from "@/components/appointments/appointment-ui";
import { CalendarDays, MoreHorizontal } from "lucide-react";
import Link from "next/link";

export type ScheduleRow = {
  id: string;
  startsAt: string;
  timezone: string | null;
  serviceName: string | null;
  inviteeName: string | null;
  status: string;
};

export function OverviewTodaySchedule({
  appointments,
  totalCount,
}: {
  appointments: ScheduleRow[];
  totalCount: number;
}) {
  const visible = appointments.slice(0, 5);
  const remaining = Math.max(0, totalCount - visible.length);

  return (
    <div className="appt-overview__card flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold text-foreground">Today&apos;s schedule</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {totalCount}
          </span>
        </div>
        <Link href="/appointments/calendar" className="appt-overview__link">
          View calendar
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays size={20} />
          </span>
          <p className="mt-3 text-sm font-semibold text-foreground">No appointments today</p>
          <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
            New bookings will appear here as they come in.
          </p>
          <Link href="/appointments/new" className="appt-overview__link mt-4">
            New appointment →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border/70">
          {visible.map((appt) => (
            <li key={appt.id}>
              <Link
                href={`/appointments/${appt.id}`}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
              >
                <div className="w-[76px] shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                  {formatAppointmentTime(appt.startsAt, appt.timezone)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    <span className="text-muted-foreground">•</span> {appt.serviceName || "Appointment"}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {appt.inviteeName || "Customer"}
                  </p>
                </div>
                <AppointmentStatusBadge status={appt.status} />
                <MoreHorizontal className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 ? (
        <div className="border-t border-border px-5 py-3">
          <Link href="/appointments/calendar" className="appt-overview__link">
            + {remaining} more appointment{remaining === 1 ? "" : "s"}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
