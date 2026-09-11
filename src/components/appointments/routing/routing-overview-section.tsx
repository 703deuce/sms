"use client";

import type { RoutingWorkspacePayload } from "@/lib/appointments/routing/routing-workspace";

type Props = {
  data: RoutingWorkspacePayload;
  onEditDefault: () => void;
  onViewServices: () => void;
  onViewActivity: () => void;
};

export function RoutingOverviewSection({ data, onEditDefault, onViewServices, onViewActivity }: Props) {
  const o = data.overview;
  const r = data.readiness;

  return (
    <div className="space-y-3 p-4 lg:px-6">
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 md:col-span-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Default assignment
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{o.defaultMethod}</p>
          <p className="mt-1 text-[var(--type-helper)] text-[var(--text-secondary)]">
            Used by {o.routableServices - o.overrideCount} services · Overrides {o.overrideCount}
          </p>
          <button type="button" className="appt-pilot-text-btn mt-2 text-xs" onClick={onEditDefault}>
            Edit default
          </button>
        </div>
        <div className="col-span-12 md:col-span-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Routable services
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{o.routableServices}</p>
          <ul className="mt-2 space-y-0.5 text-[var(--type-helper)] text-[var(--text-secondary)]">
            <li>Auto-routed {o.autoRouted}</li>
            <li>Customer chooses staff {o.customerChooses}</li>
            <li>No eligible staff {o.noEligibleStaff}</li>
          </ul>
        </div>
        <div className="col-span-12 md:col-span-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Routing health
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-primary)]">
            <li className="flex justify-between gap-2">
              <span>Availability engine</span>
              <span className="text-[var(--accent)]">Ready ✓</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Staff assignments</span>
              <span className={r.staffAssignments === "ready" ? "text-[var(--accent)]" : "text-amber-600"}>
                {r.staffAssignments === "ready" ? "Ready ✓" : "Attention"}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Calendar conflicts</span>
              <span className="text-[var(--accent)]">Ready ✓</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Services needing attention</span>
              <span>{r.servicesNeedingAttention}</span>
            </li>
          </ul>
        </div>

        <div className="col-span-12 md:col-span-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Last 30 days
          </p>
          {o.distribution.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">No assigned bookings in window yet.</p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <tbody>
                {o.distribution.map((row) => (
                  <tr key={row.staffId} className="border-t border-[var(--border)] first:border-t-0">
                    <td className="py-1.5 pr-2 text-[var(--text-primary)]">{row.staffName}</td>
                    <td className="py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                      {row.bookings} bookings
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="col-span-12 md:col-span-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Setup issues
          </p>
          {o.issues.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">No routing setup issues detected.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs text-[var(--text-primary)]">
              {o.issues.map((issue) => (
                <li key={issue.id}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Routing summary
          </p>
          <dl className="mt-2 divide-y divide-[var(--border)] text-xs">
            <div className="flex items-center justify-between gap-3 py-1.5">
              <dt className="text-[var(--text-secondary)]">Default method</dt>
              <dd className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                {o.defaultMethod}
                <button type="button" className="appt-pilot-text-btn" onClick={onEditDefault}>Edit</button>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5">
              <dt className="text-[var(--text-secondary)]">Services</dt>
              <dd className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                {o.routableServices} routable
                <button type="button" className="appt-pilot-text-btn" onClick={onViewServices}>View</button>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5">
              <dt className="text-[var(--text-secondary)]">Customer staff selection</dt>
              <dd className="font-medium text-[var(--text-primary)]">{o.defaultCustomerSelection}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5">
              <dt className="text-[var(--text-secondary)]">Overrides</dt>
              <dd className="font-medium text-[var(--text-primary)]">{o.overrideCount} services</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5">
              <dt className="text-[var(--text-secondary)]">Last routing failure</dt>
              <dd className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                None
                <button type="button" className="appt-pilot-text-btn" onClick={onViewActivity}>Activity</button>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
