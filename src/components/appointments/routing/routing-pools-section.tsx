"use client";

import type { RoutingWorkspacePayload } from "@/lib/appointments/routing/routing-workspace";

type Props = { data: RoutingWorkspacePayload };

export function RoutingPoolsSection({ data }: Props) {
  const pools = data.schedulingGroups;

  if (!pools.length) {
    return (
      <div className="p-8 text-center text-sm text-[var(--text-secondary)]">
        <p>No staff pools yet.</p>
        <p className="mt-1 text-xs">
          Scheduling groups can reuse the same staff across team booking pages. Create one only when you need a shared
          pool.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto p-4 lg:px-6">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="border-b border-[var(--border)] text-[var(--text-secondary)]">
          <tr>
            <th className="py-2 pr-3 font-medium">Pool</th>
            <th className="py-2 pr-3 font-medium">Staff</th>
            <th className="py-2 pr-3 font-medium">Services</th>
            <th className="py-2 pr-3 font-medium">Routing method</th>
            <th className="py-2 pr-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {pools.map((pool) => (
            <tr key={pool.id} className="border-b border-[var(--border)]">
              <td className="py-2 pr-3 font-medium text-[var(--text-primary)]">{pool.name}</td>
              <td className="py-2 pr-3 tabular-nums">{pool.memberCount}</td>
              <td className="py-2 pr-3 tabular-nums">{pool.serviceCount}</td>
              <td className="py-2 pr-3">{pool.methodLabel}</td>
              <td className="py-2 pr-3">
                <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5">
                  {pool.active ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
