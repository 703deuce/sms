"use client";

import { ShieldAlert } from "lucide-react";

export type SuspiciousBookingRow = {
  id: string;
  at: string;
  serviceName?: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  action: "challenge" | "block";
  signals: string[];
};

export default function SuspiciousBookingsCard({
  rows,
}: {
  rows: SuspiciousBookingRow[];
}) {
  return (
    <section className="card" aria-labelledby="suspicious-bookings-title">
      <div className="card-head">
        <span className="card-icon card-icon-warn">
          <ShieldAlert size={16} />
        </span>
        <div>
          <h2 id="suspicious-bookings-title" className="card-title">Suspicious booking log</h2>
          <p className="card-desc">
            Bookings flagged by AI Booking Protection. Review challenges and blocks before they reach your calendar.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="empty-hint">No suspicious bookings in the last 30 days.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Booking type</th>
                <th scope="col">Risk</th>
                <th scope="col">Action</th>
                <th scope="col">Signals</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap">{row.at}</td>
                  <td>{row.serviceName ?? "—"}</td>
                  <td>
                    <span
                      className={
                        row.riskLevel === "HIGH"
                          ? "chip chip-danger"
                          : row.riskLevel === "MEDIUM"
                            ? "chip chip-warn"
                            : "chip chip-neutral"
                      }
                    >
                      {row.riskLevel}
                    </span>
                  </td>
                  <td className="capitalize">{row.action}ed</td>
                  <td className="text-muted">{row.signals.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="field-hint" style={{ marginTop: 12 }}>
        Manage protection mode under{" "}
        <a href="/appointments/booking" className="link">Booking pages</a>.
      </p>
    </section>
  );
}
