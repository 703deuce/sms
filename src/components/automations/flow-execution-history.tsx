"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

type ExecutionSummary = {
  id: string;
  shortId: string;
  status: string;
  statusLabel: string;
  phone: string | null;
  phoneDisplay: string | null;
  contactName: string | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  currentNodeLabel: string | null;
  pendingCallId: string | null;
  branch: string | null;
  testMode?: boolean;
  href: string;
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold",
        status === "COMPLETED" && "bg-violet-50 text-violet-700",
        status === "RUNNING" && "bg-indigo-50 text-indigo-700",
        status === "WAITING" && "bg-amber-50 text-amber-800",
        status === "FAILED" && "bg-rose-50 text-rose-700",
        status === "CANCELLED" && "bg-slate-100 text-slate-600",
        status === "PAUSED" && "bg-amber-50 text-amber-800",
        ![
          "COMPLETED",
          "RUNNING",
          "WAITING",
          "FAILED",
          "CANCELLED",
          "PAUSED",
        ].includes(status) && "bg-slate-100 text-slate-600",
      )}
    >
      {label}
    </span>
  );
}

export function AutomationExecutionHistory({ flowId }: { flowId: string }) {
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/automations/${flowId}/executions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setExecutions(json.data);
      })
      .finally(() => setLoading(false));
  }, [flowId]);

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading executions…
      </p>
    );
  }

  if (!executions.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center">
        <p className="text-[14px] font-medium text-[#111827]">
          No executions yet
        </p>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          The workflow is the template. Each inbound call creates an{" "}
          <span className="font-semibold">Execution</span> — open one to see
          status, current node, call, transcript, and branch.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
      <div className="border-b border-[#F3F4F6] px-5 py-4">
        <h2 className="text-[15px] font-semibold text-[#111827]">Executions</h2>
        <p className="mt-0.5 text-[12px] text-[#6B7280]">
          One row per run of this workflow. Click through to debug a call.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[13px]">
          <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-wide text-[#9CA3AF]">
            <tr>
              <th className="px-4 py-2 font-semibold">Execution</th>
              <th className="px-4 py-2 font-semibold">Phone</th>
              <th className="px-4 py-2 font-semibold">Started</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Current node</th>
              <th className="px-4 py-2 font-semibold">Branch</th>
              <th className="px-4 py-2 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {executions.map((ex) => (
              <tr
                key={ex.id}
                className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB]"
              >
                <td className="px-4 py-3 font-semibold text-[#111827]">
                  #{ex.shortId}
                  {ex.testMode ? (
                    <span className="ml-1 text-[11px] font-medium text-[#9CA3AF]">
                      test
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-[#374151]">
                  <div>{ex.phoneDisplay || ex.phone || "—"}</div>
                  {ex.contactName ? (
                    <div className="text-[11px] text-[#9CA3AF]">
                      {ex.contactName}
                    </div>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[#6B7280]">
                  {new Date(ex.startedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={ex.status} label={ex.statusLabel} />
                  {ex.error ? (
                    <div className="mt-1 max-w-[160px] truncate text-[11px] text-rose-600">
                      {ex.error}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-[#374151]">
                  {ex.currentNodeLabel || "—"}
                </td>
                <td className="px-4 py-3 text-[#374151]">{ex.branch || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={ex.href}
                    className="text-[12px] font-semibold text-[#4f46e5] hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FlowActionButtons({
  flowId,
  status,
}: {
  flowId: string;
  status: string;
}) {
  async function patch(action: string) {
    await fetch(`/api/automations/${flowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    window.location.reload();
  }

  async function publish() {
    const res = await fetch(`/api/automations/${flowId}/publish`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const json = await res.json();
      alert(json.error || "Publish failed");
      return;
    }
    window.location.reload();
  }

  if (status === "Draft" || status === "DRAFT") {
    return (
      <>
        <button
          type="button"
          onClick={() => void publish()}
          className="inline-flex h-9 items-center rounded-md bg-[#111827] px-3 text-[12px] font-semibold text-white"
        >
          Activate flow
        </button>
        <a
          href={`/automations/${flowId}/edit`}
          className="inline-flex h-9 items-center rounded-md px-3 text-[12px] font-semibold ring-1 ring-[#E5E7EB]"
        >
          Edit in builder
        </a>
      </>
    );
  }
  if (status === "Paused" || status === "PAUSED") {
    return (
      <button
        type="button"
        onClick={() => void patch("resume")}
        className="inline-flex h-9 items-center rounded-md bg-[#111827] px-3 text-[12px] font-semibold text-white"
      >
        Resume
      </button>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => void patch("pause")}
        className="inline-flex h-9 items-center rounded-md px-3 text-[12px] font-semibold ring-1 ring-[#E5E7EB]"
      >
        Pause
      </button>
      <a
        href={`/automations/${flowId}/edit`}
        className="inline-flex h-9 items-center rounded-md px-3 text-[12px] font-semibold ring-1 ring-[#E5E7EB]"
      >
        Edit in builder
      </a>
      <a
        href={`/automations/${flowId}?tab=executions`}
        className="inline-flex h-9 items-center rounded-md px-3 text-[12px] font-semibold text-[#4f46e5] ring-1 ring-indigo-200"
      >
        Executions
      </a>
    </>
  );
}
