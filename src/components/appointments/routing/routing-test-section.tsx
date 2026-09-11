"use client";

import { useState } from "react";
import type { RoutingWorkspacePayload } from "@/lib/appointments/routing/routing-workspace";
import type { RoutingSimulateResult } from "@/lib/appointments/routing/routing-simulator";

type Props = {
  data: RoutingWorkspacePayload;
  simulating: boolean;
  result: RoutingSimulateResult | null;
  onRun: (input: {
    serviceName: string;
    startsAt: string;
    locationId?: string;
    preferredStaffId?: string;
  }) => void;
};

export function RoutingTestSection({ data, simulating, result, onRun }: Props) {
  const [serviceName, setServiceName] = useState(data.services[0]?.name || "");
  const [startsAt, setStartsAt] = useState("");
  const [locationId, setLocationId] = useState("");

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2 lg:px-6">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Test inputs</h2>
        <div className="mt-3 space-y-2">
          <label className="block">
            <span className="text-[var(--text-secondary)]">Service</span>
            <select
              className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
            >
              {data.services.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[var(--text-secondary)]">Date & time</span>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-[var(--text-secondary)]">Location</span>
            <select
              className="mt-1 w-full rounded-md border border-[var(--border)] px-2 py-1.5"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">Any</option>
              {data.locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="appt-pilot-primary-btn mt-2"
            disabled={simulating || !serviceName || !startsAt}
            onClick={() =>
              onRun({
                serviceName,
                startsAt: startsAt.length === 16 ? `${startsAt}:00` : startsAt,
                locationId: locationId || undefined,
              })
            }
          >
            {simulating ? "Running…" : "Run test"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Result</h2>
        {!result ? (
          <p className="mt-3 text-[var(--text-secondary)]">Run a scenario to see candidates and assignment reason.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                {result.selectedStaffName || "No available staff"}
              </p>
              <p className="mt-1 text-[var(--text-secondary)]">{result.reason}</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[var(--text-secondary)]">
                  <th className="py-1 text-left">Candidate</th>
                  <th className="py-1 text-left">Eligible</th>
                  <th className="py-1 text-left">Available</th>
                  <th className="py-1 text-right">RR count</th>
                </tr>
              </thead>
              <tbody>
                {result.candidates.map((c) => (
                  <tr key={c.staffId} className="border-t border-[var(--border)]">
                    <td className="py-1.5">{c.staffName}</td>
                    <td className="py-1.5">{c.eligible ? "✓" : "✕"}</td>
                    <td className="py-1.5">{c.available ? "✓" : "✕"}</td>
                    <td className="py-1.5 text-right tabular-nums">{c.roundRobinCount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="list-disc pl-4 text-[var(--text-secondary)]">
              {result.pipeline.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
