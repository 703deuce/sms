"use client";

import type { RoutingWorkspacePayload } from "@/lib/appointments/routing/routing-workspace";

type Props = {
  data: RoutingWorkspacePayload;
  onSelect: (id: string) => void;
};

export function RoutingServicesSection({ data, onSelect }: Props) {
  return (
    <div className="overflow-x-auto p-4 lg:px-6">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="border-b border-[var(--border)] text-[var(--text-secondary)]">
          <tr>
            <th className="py-2 pr-3 font-medium">Service</th>
            <th className="py-2 pr-3 font-medium">Staff selection</th>
            <th className="py-2 pr-3 font-medium">Routing method</th>
            <th className="py-2 pr-3 font-medium">Eligible staff</th>
            <th className="py-2 pr-3 font-medium">Locations</th>
            <th className="py-2 pr-3 font-medium">Policy</th>
            <th className="py-2 pr-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.services.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer border-b border-[var(--border)] hover:bg-[var(--surface-muted)]"
              onClick={() => onSelect(row.id)}
            >
              <td className="py-2 pr-3 font-medium text-[var(--text-primary)]">{row.name}</td>
              <td className="py-2 pr-3">{row.customerSelection}</td>
              <td className="py-2 pr-3">{row.methodLabel}</td>
              <td className="py-2 pr-3 tabular-nums">{row.eligibleStaff}</td>
              <td className="py-2 pr-3 tabular-nums">{row.locationCount}</td>
              <td className="py-2 pr-3">
                <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5">
                  {row.usesDefault ? "Default" : "Custom"}
                </span>
              </td>
              <td className="py-2 pr-3">
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    row.status === "ready"
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : row.status === "na"
                        ? "bg-[var(--surface-muted)]"
                        : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {row.status === "ready" ? "Ready" : row.status === "na" ? "N/A" : "Needs setup"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
