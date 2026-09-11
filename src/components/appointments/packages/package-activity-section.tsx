"use client";

import type { PackageActivityView } from "@/features/appointments/kimi/packages/use-package-editor";
import { Panel } from "@/components/appointments/workspace-ui";
import { Activity } from "lucide-react";

type Props = {
  activity: PackageActivityView[];
};

function formatWhen(value: string): string {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PackageActivitySection({ activity }: Props) {
  return (
    <div className="ws-section-wide">
      <Panel title="Activity" icon={Activity} flush>
        {activity.length === 0 ? (
          <p className="px-4 py-6 text-[var(--type-list)] text-[var(--text-secondary)]">
            Package purchases and redemptions will appear here.
          </p>
        ) : (
          <table className="ws-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Customer</th>
                <th scope="col">Event</th>
                <th scope="col">Balance</th>
                <th scope="col">Reference</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((row) => (
                <tr key={row.id}>
                  <td>{formatWhen(row.createdAt)}</td>
                  <td>{row.contactName}</td>
                  <td>{row.kind}</td>
                  <td>{row.balanceAfter ?? "—"}</td>
                  <td>{row.note || row.appointmentId || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
