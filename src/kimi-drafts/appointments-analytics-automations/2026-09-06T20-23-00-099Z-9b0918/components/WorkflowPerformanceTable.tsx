"use client";

import { formatNumber, type WorkflowRow } from "../mock-data";
import { Card } from "./MetricCard";

function StatusChip({ status }: { status: WorkflowRow["status"] }) {
  const styles: Record<WorkflowRow["status"], { bg: string; fg: string; label: string }> = {
    active: { bg: "#ecfdf5", fg: "#047857", label: "Active" },
    paused: { bg: "#fffbeb", fg: "#b45309", label: "Paused" },
    draft: { bg: "#f1f3f6", fg: "#64748b", label: "Draft" },
  };
  const s = styles[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

export function WorkflowPerformanceTable({ workflows }: { workflows: WorkflowRow[] }) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
            Workflow performance
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Delivery and response metrics per automation workflow.
          </p>
        </div>
        <a
          href="/appointments/workflows"
          className="text-[13px] font-semibold text-primary hover:underline"
        >
          Manage workflows
        </a>
      </div>
      <div className="overflow-x-auto tv-scrollbar">
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <caption className="sr-only">Workflow performance metrics</caption>
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="px-5 py-3">Workflow</th>
              <th scope="col" className="px-3 py-3">Status</th>
              <th scope="col" className="px-3 py-3 text-right">Enrolled</th>
              <th scope="col" className="px-3 py-3 text-right">Steps sent</th>
              <th scope="col" className="px-3 py-3 text-right">Delivery</th>
              <th scope="col" className="px-3 py-3 text-right">Replies</th>
              <th scope="col" className="px-5 py-3 text-right">Confirmed</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((w) => (
              <tr
                key={w.id}
                className="border-b border-border last:border-0 transition-colors hover:bg-muted/50"
              >
                <td className="px-5 py-3.5">
                  <a
                    href={`/appointments/workflows/${w.id}/edit`}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {w.name}
                  </a>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Trigger: {w.trigger}
                  </p>
                </td>
                <td className="px-3 py-3.5">
                  <StatusChip status={w.status} />
                </td>
                <td className="px-3 py-3.5 text-right tabular-nums text-foreground">
                  {formatNumber(w.enrolled)}
                </td>
                <td className="px-3 py-3.5 text-right tabular-nums">
                  <span className="text-foreground">{formatNumber(w.stepsSent)}</span>
                  {w.failed > 0 ? (
                    <span className="ml-1.5 text-xs" style={{ color: "#dc2626" }}>
                      {w.failed} failed
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3.5 text-right tabular-nums text-foreground">
                  {w.stepsSent > 0 ? `${w.deliveryRate.toFixed(1)}%` : "—"}
                </td>
                <td className="px-3 py-3.5 text-right tabular-nums text-foreground">
                  {w.stepsSent > 0 ? (
                    <>
                      {formatNumber(w.replies)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({w.replyRate.toFixed(1)}%)
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                  {w.confirmed > 0 ? (
                    <>
                      {formatNumber(w.confirmed)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({w.confirmationRate.toFixed(1)}%)
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
