"use client";

import type { FormsWorkspaceStats } from "@/features/appointments/kimi/forms-documents/use-forms-documents-workspace";

type Props = { stats?: FormsWorkspaceStats };

export function FormsSummaryStrip({ stats }: Props) {
  if (!stats) return null;
  const items = [
    { label: "Forms", value: stats.formsCount },
    { label: "Documents", value: stats.documentsCount },
    { label: "Assigned", value: stats.assignedLinks },
    { label: "Pending completion", value: stats.pendingCompletion },
    { label: "Submissions this month", value: stats.submissionsThisMonth },
    { label: "Signatures pending", value: stats.signaturesPending },
  ];
  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 lg:px-6">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              {item.label}
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
