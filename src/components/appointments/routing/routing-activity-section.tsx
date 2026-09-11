"use client";

import type { RoutingWorkspacePayload } from "@/lib/appointments/routing/routing-workspace";

type Props = { data: RoutingWorkspacePayload };

export function RoutingActivitySection({ data }: Props) {
  if (!data.activity.length) {
    return (
      <div className="p-8 text-center text-sm text-[var(--text-secondary)]">
        Automatic routing activity will appear after bookings are assigned to staff.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto p-4 lg:px-6">
      <table className="w-full min-w-[800px] text-left text-xs">
        <thead className="border-b border-[var(--border)] text-[var(--text-secondary)]">
          <tr>
            <th className="py-2 pr-3 font-medium">Time</th>
            <th className="py-2 pr-3 font-medium">Booking</th>
            <th className="py-2 pr-3 font-medium">Service</th>
            <th className="py-2 pr-3 font-medium">Assigned staff</th>
            <th className="py-2 pr-3 font-medium">Method</th>
            <th className="py-2 pr-3 font-medium">Source</th>
            <th className="py-2 pr-3 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {data.activity.map((row) => (
            <tr key={row.id} className="border-b border-[var(--border)]">
              <td className="py-2 pr-3 whitespace-nowrap text-[var(--text-secondary)]">
                {new Date(row.at).toLocaleString()}
              </td>
              <td className="py-2 pr-3">{row.bookingLabel}</td>
              <td className="py-2 pr-3">{row.serviceName}</td>
              <td className="py-2 pr-3 font-medium">{row.staffName}</td>
              <td className="py-2 pr-3">{row.method}</td>
              <td className="py-2 pr-3">{row.source}</td>
              <td className="py-2 pr-3">{row.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
