"use client";

import type { ExecutionDetailView } from "@/lib/automations/execution-detail";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function Bool({ value }: { value: boolean | null | undefined }) {
  if (value == null) return <span className="text-[#9CA3AF]">—</span>;
  return (
    <span className={value ? "font-semibold text-emerald-700" : "text-[#6B7280]"}>
      {value ? "Yes" : "No"}
    </span>
  );
}

export function ExecutionDetailViewPanel({
  flowId,
  executionId,
}: {
  flowId: string;
  executionId: string;
}) {
  const [data, setData] = useState<ExecutionDetailView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/automations/${flowId}/executions/${executionId}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load execution");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [flowId, executionId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      void load();
    }, 8000);
    return () => clearInterval(t);
  }, [load]);

  if (loading && !data) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Loading execution…
      </p>
    );
  }
  if (error && !data) {
    return <p className="py-10 text-center text-sm text-rose-600">{error}</p>;
  }
  if (!data) return null;

  const running = data.status === "RUNNING" || data.status === "WAITING";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-[#6B7280]">
            <Link
              href={`/automations/${flowId}?tab=executions`}
              className="hover:underline"
            >
              {data.flowName}
            </Link>
          </p>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight text-[#111827]">
            Execution #{data.shortId}
          </h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Workflow template · v{data.flowVersion}
            {data.testMode ? " · test mode" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold",
              data.status === "COMPLETED" && "bg-emerald-50 text-emerald-700",
              data.status === "RUNNING" && "bg-sky-50 text-sky-700",
              data.status === "WAITING" && "bg-amber-50 text-amber-800",
              data.status === "FAILED" && "bg-rose-50 text-rose-700",
              !["COMPLETED", "RUNNING", "WAITING", "FAILED"].includes(
                data.status,
              ) && "bg-slate-100 text-slate-600",
            )}
          >
            {data.statusLabel}
            {running ? " · live" : ""}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="h-8 rounded-md px-3 text-[12px] font-semibold ring-1 ring-[#E5E7EB]"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Phone", data.phoneDisplay || data.phone || "—"],
          ["Started", new Date(data.startedAt).toLocaleString()],
          ["Current node", data.currentNodeLabel || "—"],
          ["Call", data.callStatusLabel || "—"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
              {label}
            </div>
            <div className="mt-1 text-[14px] font-semibold text-[#111827]">
              {value}
            </div>
          </div>
        ))}
      </div>

      {data.status === "COMPLETED" || data.outcome.branch || data.call ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
          <h2 className="text-[14px] font-semibold text-[#111827]">
            Outcome summary
          </h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[13px]">
            <div>
              <dt className="text-[#9CA3AF]">Booked</dt>
              <dd className="mt-0.5">
                <Bool value={data.outcome.booked} />
              </dd>
            </div>
            <div>
              <dt className="text-[#9CA3AF]">Calendar</dt>
              <dd className="mt-0.5">
                <Bool value={data.outcome.calendarCreated} />
              </dd>
            </div>
            <div>
              <dt className="text-[#9CA3AF]">Duration</dt>
              <dd className="mt-0.5 font-medium text-[#111827]">
                {data.outcome.durationLabel || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[#9CA3AF]">Branch</dt>
              <dd className="mt-0.5 font-medium text-[#111827]">
                {data.outcome.branch || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[#9CA3AF]">SMS sent</dt>
              <dd className="mt-0.5">
                <Bool value={data.outcome.smsSent} />
              </dd>
            </div>
            <div>
              <dt className="text-[#9CA3AF]">Transfer</dt>
              <dd className="mt-0.5">
                <Bool value={data.outcome.transferCompleted} />
              </dd>
            </div>
            <div>
              <dt className="text-[#9CA3AF]">Answered</dt>
              <dd className="mt-0.5">
                <Bool value={data.outcome.answered} />
              </dd>
            </div>
            <div>
              <dt className="text-[#9CA3AF]">Caller hung up</dt>
              <dd className="mt-0.5">
                <Bool value={data.outcome.callerHungUp} />
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
          <h2 className="text-[14px] font-semibold text-[#111827]">
            Call
          </h2>
          {data.call ? (
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-[#9CA3AF]">Call ID</dt>
                <dd className="break-all font-mono text-[11px]">{data.call.callId}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#9CA3AF]">Agent</dt>
                <dd className="font-medium">
                  {data.call.agentName || data.call.agentId || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#9CA3AF]">Direction</dt>
                <dd>{data.call.direction}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#9CA3AF]">Status</dt>
                <dd>{data.call.status}</dd>
              </div>
              {data.call.transcriptPreview ? (
                <div>
                  <dt className="text-[#9CA3AF]">Transcript</dt>
                  <dd className="mt-1 rounded-md bg-[#F9FAFB] p-2 text-[12px] text-[#374151]">
                    {data.call.transcriptPreview}
                    {data.call.transcriptPreview.length >= 500 ? "…" : ""}
                  </dd>
                </div>
              ) : (
                <div className="text-[12px] text-[#9CA3AF]">
                  {data.call.answered
                    ? "Transcript not ready yet"
                    : "Waiting for connect"}
                </div>
              )}
              {data.call.toolCalls.length ? (
                <div>
                  <dt className="text-[#9CA3AF]">Tool calls</dt>
                  <ul className="mt-1 space-y-1">
                    {data.call.toolCalls.map((t) => (
                      <li
                        key={t.id}
                        className="rounded-md bg-[#F9FAFB] px-2 py-1 text-[12px]"
                      >
                        <span className="font-medium">
                          {t.toolName || "tool"}
                        </span>{" "}
                        · {t.status}
                        {t.errorMessage ? (
                          <span className="text-rose-600">
                            {" "}
                            — {t.errorMessage}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.call.appointments.length ? (
                <div>
                  <dt className="text-[#9CA3AF]">Appointments</dt>
                  <ul className="mt-1 space-y-1 text-[12px]">
                    {data.call.appointments.map((a) => (
                      <li key={a.id}>
                        {a.serviceName || "Appointment"} ·{" "}
                        {new Date(a.startsAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-2 text-[13px] text-[#6B7280]">
              No call bound yet. For inbound, enrollment should set{" "}
              <code className="text-[11px]">pendingCallId</code> when the phone
              rings.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
          <h2 className="text-[14px] font-semibold text-[#111827]">
            Variables
          </h2>
          <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-[#F9FAFB] p-3 text-[11px] text-[#374151]">
            {JSON.stringify(
              {
                ...data.variables,
                pendingCallId: data.metadata.pendingCallId || null,
                lastCallResultBranch: data.metadata.lastCallResultBranch || null,
                inboundAttach: data.metadata.inboundAttach || false,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
        <h2 className="text-[14px] font-semibold text-[#111827]">
          Node path
        </h2>
        {data.path.length === 0 ? (
          <p className="mt-2 text-[13px] text-[#6B7280]">
            No steps recorded yet — execution may still be on the trigger.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {data.path.map((step, i) => (
              <li
                key={`${step.nodeId}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded-md bg-[#F9FAFB] px-3 py-2 text-[13px]"
              >
                <span className="font-semibold text-[#111827]">
                  {i + 1}. {step.label}
                </span>
                <span className="text-[11px] text-[#9CA3AF]">
                  {step.blockType}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                    step.status === "completed" &&
                      "bg-emerald-50 text-emerald-700",
                    step.status === "failed" && "bg-rose-50 text-rose-700",
                    step.status !== "completed" &&
                      step.status !== "failed" &&
                      "bg-slate-100 text-slate-600",
                  )}
                >
                  {step.status}
                </span>
                {step.branchTaken ? (
                  <span className="text-[12px] text-[#4B5563]">
                    Branch: {step.branchTaken}
                  </span>
                ) : null}
                {step.error ? (
                  <span className="text-[12px] text-rose-600">{step.error}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
        <h2 className="text-[14px] font-semibold text-[#111827]">Logs</h2>
        <ul className="mt-3 max-h-80 space-y-1 overflow-auto font-mono text-[11px]">
          {data.logs.map((log, i) => (
            <li
              key={`${log.at}-${i}`}
              className={cn(
                "rounded px-2 py-1",
                log.level === "error"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-[#F9FAFB] text-[#374151]",
              )}
            >
              <span className="text-[#9CA3AF]">
                {new Date(log.at).toLocaleTimeString()}
              </span>{" "}
              {log.message}
            </li>
          ))}
        </ul>
      </div>

      {data.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-700">
          {data.error}
        </div>
      ) : null}
    </div>
  );
}
