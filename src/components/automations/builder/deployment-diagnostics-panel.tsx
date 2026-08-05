"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Diagnostics = {
  workflowId: string;
  workflowName: string;
  workflowStatus: string;
  triggerNodeId: string | null;
  agentId: string | null;
  agentName: string | null;
  telnyxAssistantId: string | null;
  phoneNumberId: string | null;
  phoneE164: string | null;
  texmlApplicationOrConnection: string | null;
  publishedRoutingTarget: string | null;
  deploymentStatus: string | null;
  lastPublishTime: string | null;
  lastProviderVerification: string | null;
  lastInboundTrigger: string | null;
  lastExecutionId: string | null;
  lastExecutionStatus: string | null;
  lastError: string | null;
  layers: Record<string, string | boolean>;
};

type Check = {
  id: string;
  label: string;
  status: "pass" | "fail" | "not_verified";
  detail?: string | null;
};

export function DeploymentDiagnosticsPanel({ flowId }: { flowId: string }) {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [overall, setOverall] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callId, setCallId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/automations/${flowId}/diagnostics`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load diagnostics");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runTest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/automations/${flowId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: callId ? "verify_call" : "validate",
          callId: callId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Test failed");
      setChecks(json.data.checks || []);
      setOverall(json.data.overall || null);
      if (json.data.diagnostics) setData(json.data.diagnostics);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const rows: Array<[string, string | null | undefined]> = data
    ? [
        ["Workflow ID", data.workflowId],
        ["Trigger node ID", data.triggerNodeId],
        ["Agent", data.agentName || data.agentId],
        ["Telnyx assistant ID", data.telnyxAssistantId],
        ["Phone number", data.phoneE164 || data.phoneNumberId],
        ["TeXML / connection", data.texmlApplicationOrConnection],
        ["Published routing target", data.publishedRoutingTarget],
        ["Deployment status", data.deploymentStatus],
        ["Workflow status", data.workflowStatus],
        ["Last publish", data.lastPublishTime],
        ["Last provider verification", data.lastProviderVerification],
        ["Last inbound trigger", data.lastInboundTrigger],
        ["Last execution", data.lastExecutionId],
        ["Last execution status", data.lastExecutionStatus],
        ["Last error", data.lastError],
      ]
    : [];

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-[#111827]">
            Deployment diagnostics
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Prove activation and Telnyx routing, then open an{" "}
            <span className="font-semibold">Execution</span> after a live call
            to prove resume and branches.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data?.lastExecutionId ? (
            <a
              href={`/automations/${flowId}/executions/${data.lastExecutionId}`}
              className="inline-flex h-8 items-center rounded-md px-3 text-[12px] font-semibold text-[#2563EB] ring-1 ring-[#BFDBFE]"
            >
              Open last execution
            </a>
          ) : (
            <a
              href={`/automations/${flowId}?tab=executions`}
              className="inline-flex h-8 items-center rounded-md px-3 text-[12px] font-semibold ring-1 ring-[#E5E7EB]"
            >
              Executions
            </a>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="h-8 rounded-md px-3 text-[12px] font-semibold ring-1 ring-[#E5E7EB]"
            disabled={loading}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void runTest()}
            className="h-8 rounded-md bg-[#111827] px-3 text-[12px] font-semibold text-white"
            disabled={loading}
          >
            Run test checks
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-[13px] text-rose-600">{error}</p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md bg-[#F9FAFB] px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
              {label}
            </div>
            <div className="mt-0.5 break-all text-[12px] text-[#111827]">
              {value || "—"}
            </div>
          </div>
        ))}
      </div>

      {data?.layers ? (
        <div className="mt-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Failure layer map
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {Object.entries(data.layers).map(([k, v]) => (
              <li
                key={k}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium",
                  v === "ok" || v === true
                    ? "bg-emerald-50 text-emerald-700"
                    : v === "ready"
                      ? "bg-sky-50 text-sky-700"
                      : v === "error" || v === false
                        ? "bg-rose-50 text-rose-700"
                        : v === "missing" || v === "draft"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600",
                )}
              >
                {k}: {String(v)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-[12px] text-[#6B7280]">
          Optional callId (after live call)
          <input
            className="mt-1 h-8 w-72 rounded-md border border-[#E5E7EB] px-2 text-[12px]"
            value={callId}
            onChange={(e) => setCallId(e.target.value)}
            placeholder="voice_calls.id"
          />
        </label>
        {overall ? (
          <span
            className={cn(
              "inline-flex h-8 items-center rounded-md px-2 text-[12px] font-semibold",
              overall === "pass"
                ? "bg-emerald-50 text-emerald-700"
                : overall === "fail"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-amber-50 text-amber-700",
            )}
          >
            Overall: {overall}
          </span>
        ) : null}
      </div>

      {checks.length ? (
        <ul className="mt-3 space-y-1.5">
          {checks.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-2 rounded-md border border-[#F3F4F6] px-3 py-2 text-[12px]"
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex min-w-[88px] justify-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                  c.status === "pass" && "bg-emerald-50 text-emerald-700",
                  c.status === "fail" && "bg-rose-50 text-rose-700",
                  c.status === "not_verified" && "bg-slate-100 text-slate-600",
                )}
              >
                {c.status === "not_verified" ? "Not verified" : c.status}
              </span>
              <div>
                <div className="font-medium text-[#111827]">{c.label}</div>
                {c.detail ? (
                  <div className="text-[#6B7280]">{c.detail}</div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
