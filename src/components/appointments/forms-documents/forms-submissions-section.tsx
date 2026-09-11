"use client";

import type { SubmissionRow } from "@/lib/appointments/forms-documents/forms-workspace";

type Props = {
  rows: SubmissionRow[];
  onSelect: (id: string) => void;
};

function statusChip(status: SubmissionRow["status"]) {
  if (status === "signed") return <span className="ws-chip ws-chip-success">Signed</span>;
  if (status === "complete") return <span className="ws-chip ws-chip-success">Complete</span>;
  if (status === "incomplete") return <span className="ws-chip ws-chip-warning">Incomplete</span>;
  return <span className="ws-chip ws-chip-neutral">Pending</span>;
}

export function FormsSubmissionsSection({ rows, onSelect }: Props) {
  return (
    <div className="ws-panel overflow-x-auto">
      {rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">
          Customer submissions will appear here.
        </p>
      ) : (
        <table className="ws-table w-full min-w-[880px]">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Form / document</th>
              <th>Booking</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Signature / files</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="cursor-pointer hover:bg-[var(--surface-muted)]" onClick={() => onSelect(row.id)}>
                <td className="font-medium">{row.customerLabel}</td>
                <td>{row.formName}</td>
                <td className="text-[var(--text-secondary)]">{row.bookingLabel}</td>
                <td className="whitespace-nowrap text-[var(--text-secondary)]">
                  {new Date(row.submittedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                <td>{statusChip(row.status)}</td>
                <td className="text-[var(--text-secondary)]">
                  {row.hasSignature ? "Signature" : "—"}
                  {row.filesCount > 0 ? ` · ${row.filesCount} file${row.filesCount === 1 ? "" : "s"}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
