"use client";

import Link from "next/link";
import { ClipboardList, MoreHorizontal } from "lucide-react";
import type { LibraryRow } from "@/lib/appointments/forms-documents/forms-workspace";

type Props = {
  rows: LibraryRow[];
  query: string;
  typeFilter: string;
  statusFilter: string;
  onQueryChange: (v: string) => void;
  onTypeFilterChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
  onDuplicate: (id: string) => void;
  onDeactivate: (id: string) => void;
  onAssign: (id: string) => void;
};

function kindChip(kind: LibraryRow["kind"]) {
  const label =
    kind === "waiver"
      ? "Waiver"
      : kind === "agreement"
        ? "Agreement"
        : kind === "upload"
          ? "Upload"
          : kind === "questionnaire"
            ? "Questionnaire"
            : "Form";
  return <span className="ws-chip ws-chip-neutral">{label}</span>;
}

export function FormsLibrarySection({
  rows,
  query,
  typeFilter,
  statusFilter,
  onQueryChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onDuplicate,
  onDeactivate,
  onAssign,
}: Props) {
  return (
    <div className="ws-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <input
          className="input min-w-[200px] flex-1"
          placeholder="Search forms and documents"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search library"
        />
        <select className="input w-auto" value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)}>
          <option value="all">All types</option>
          <option value="form">Form</option>
          <option value="questionnaire">Questionnaire</option>
          <option value="waiver">Waiver</option>
          <option value="agreement">Agreement</option>
          <option value="upload">Upload</option>
        </select>
        <select className="input w-auto" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="ws-icon-tile" aria-hidden>
            <ClipboardList className="h-5 w-5" />
          </span>
          <p className="font-semibold text-[var(--text-primary)]">No forms or documents yet</p>
          <p className="max-w-md text-sm text-[var(--text-secondary)]">
            Collect customer information, waivers, signatures, and files as part of the booking process.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="ws-table w-full min-w-[900px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Fields / requirements</th>
                <th>Assigned to</th>
                <th>Submissions</th>
                <th>Status</th>
                <th>Updated</th>
                <th className="w-12">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link
                      href={`/appointments/forms-documents/${row.id}`}
                      className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td>{kindChip(row.kind)}</td>
                  <td className="text-[var(--text-secondary)]">{row.requirementsLabel}</td>
                  <td>
                    {row.assignedCount > 0 ? (
                      <button type="button" className="ws-text-btn" onClick={() => onAssign(row.id)}>
                        {row.assignedCount} offering{row.assignedCount === 1 ? "" : "s"}
                      </button>
                    ) : (
                      <span className="text-[var(--text-secondary)]">—</span>
                    )}
                  </td>
                  <td className="tabular-nums">{row.submissionCount}</td>
                  <td>
                    {row.active ? (
                      <span className="ws-chip ws-chip-success">Active</span>
                    ) : (
                      <span className="ws-chip ws-chip-neutral">Inactive</span>
                    )}
                  </td>
                  <td className="text-[var(--text-secondary)] whitespace-nowrap">
                    {new Date(row.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>
                    <details className="relative">
                      <summary className="ws-icon-btn list-none cursor-pointer" aria-label={`Actions for ${row.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </summary>
                      <div className="absolute right-0 z-10 mt-1 min-w-[180px] rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
                        <Link
                          className="block px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)]"
                          href={`/appointments/forms-documents/${row.id}/builder`}
                        >
                          Edit in builder
                        </Link>
                        <Link
                          className="block px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)]"
                          href={`/appointments/forms-documents/${row.id}?section=submissions`}
                        >
                          View submissions
                        </Link>
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-muted)]"
                          onClick={() => onAssign(row.id)}
                        >
                          Manage assignments
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-muted)]"
                          onClick={() => void onDuplicate(row.id)}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-muted)]"
                          onClick={() => void onDeactivate(row.id)}
                        >
                          {row.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
