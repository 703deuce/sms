"use client";

import Link from "next/link";

type StaffCalendarRow = {
  staffId: string;
  staffName: string;
  connectionLabel: string;
  connected: boolean;
};

type ConnectionRow = {
  id: string;
  provider: string;
  name: string;
  status: string;
  lastSyncAt?: string | null;
};

type Props = {
  staffRows: StaffCalendarRow[];
  connections: ConnectionRow[];
};

export function AvailabilityCalendarsSection({ staffRows, connections }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[var(--type-section)] font-semibold text-[var(--text-primary)]">Calendar conflicts</h2>
          <p className="ws-stat-note">Connected calendars block availability when busy events are detected.</p>
        </div>
        <Link href="/integrations/calendars" className="ws-secondary-btn">Manage calendars</Link>
      </div>

      {staffRows.length === 0 ? (
        <div className="ws-empty">
          <h3 className="ws-empty-title">No calendars are blocking availability</h3>
          <p className="ws-empty-copy">Connect Google or Microsoft calendars to block busy times.</p>
          <Link href="/integrations/calendars" className="appt-pilot-primary-btn">Manage calendars</Link>
        </div>
      ) : (
        <div className="ws-panel overflow-hidden">
          <table className="ws-table">
            <thead>
              <tr>
                <th scope="col">Staff</th>
                <th scope="col">Calendar connection</th>
                <th scope="col">Block busy time</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.map((row) => (
                <tr key={row.staffId}>
                  <td>{row.staffName}</td>
                  <td>{row.connectionLabel}</td>
                  <td>{row.connected ? "Yes" : "—"}</td>
                  <td>
                    <span className={row.connected ? "ws-badge is-success" : "ws-badge"}>
                      {row.connected ? "Connected" : "Not connected"}
                    </span>
                  </td>
                  <td className="text-right">
                    <Link href="/integrations/calendars" className="ws-text-btn">Manage</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {connections.length > 0 ? (
        <div className="ws-panel px-4 py-3">
          <h3 className="ws-field-label mb-2">Workspace connections</h3>
          <ul className="space-y-2 text-[var(--type-list)]">
            {connections.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span>{c.provider} · {c.name}</span>
                <span className="text-[var(--text-secondary)]">
                  {c.lastSyncAt ? `Synced ${new Date(c.lastSyncAt).toLocaleString()}` : c.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
