"use client";

import Link from "next/link";
import type { DocumentRow } from "@/lib/appointments/forms-documents/forms-workspace";

type Props = { rows: DocumentRow[] };

export function FormsDocumentsSection({ rows }: Props) {
  return (
    <div className="ws-panel overflow-x-auto">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <p className="text-sm text-[var(--text-secondary)]">
          Waivers and intake documents share the intake form builder. Formal contracts use contract templates.
        </p>
        <Link href="/appointments/contracts" className="ws-text-btn shrink-0">
          Contract templates
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-[var(--text-secondary)]">No documents yet.</p>
      ) : (
        <table className="ws-table w-full min-w-[800px]">
          <thead>
            <tr>
              <th>Document</th>
              <th>Type</th>
              <th>Signature</th>
              <th>Assigned</th>
              <th>Completions</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.kind}-${row.id}`}>
                <td className="font-medium">
                  {row.kind === "contract" && !row.id.startsWith("c") ? (
                    <Link href={`/appointments/forms-documents/${row.id}`}>{row.name}</Link>
                  ) : row.kind === "contract" ? (
                    <Link href="/appointments/contracts">{row.name}</Link>
                  ) : (
                    <Link href={`/appointments/forms-documents/${row.id}`}>{row.name}</Link>
                  )}
                </td>
                <td className="capitalize">{row.kind}</td>
                <td>{row.signatureRequired ? "Required" : "—"}</td>
                <td className="tabular-nums">{row.assignedCount}</td>
                <td className="tabular-nums">{row.completionsCount}</td>
                <td>
                  {row.active ? (
                    <span className="ws-chip ws-chip-success">Active</span>
                  ) : (
                    <span className="ws-chip ws-chip-neutral">Inactive</span>
                  )}
                </td>
                <td className="text-[var(--text-secondary)]">
                  {new Date(row.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
