"use client";

import type { CalendarApiAppointment } from "@/features/appointments/kimi/calendar/map-calendar";
import { formatAppointmentTime } from "@/components/appointments/appointment-ui";

type Props = {
  rows: CalendarApiAppointment[];
  onSelect: (id: string) => void;
};

export function AgendaListView({ rows, onSelect }: Props) {
  const grouped = rows.reduce<Record<string, CalendarApiAppointment[]>>((acc, row) => {
    const key = new Date(row.startsAt).toDateString();
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});

  const days = Object.keys(grouped).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  if (!days.length) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
        No bookings in this period.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map((dayKey) => (
        <section key={dayKey} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <header className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold">
            {new Date(dayKey).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </header>
          <table className="w-full text-left text-xs">
            <thead className="text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Client / title</th>
                <th className="px-3 py-2">Booking</th>
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Attention</th>
              </tr>
            </thead>
            <tbody>
              {grouped[dayKey].map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)] cursor-pointer"
                  onClick={() => onSelect(row.id)}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatAppointmentTime(row.startsAt, row.timezone)}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {row.inviteeName || row.registrationSummary || "—"}
                  </td>
                  <td className="px-3 py-2">{row.serviceName}</td>
                  <td className="px-3 py-2">{row.staffLabel || "—"}</td>
                  <td className="px-3 py-2">{row.locationLabel || "—"}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.paymentLabel || (row.attentionFlags?.length ? "!" : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
