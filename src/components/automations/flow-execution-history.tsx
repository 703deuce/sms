"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useEffect, useState } from "react";

type Execution = {
  id: string;
  status: string;
  currentNodeId: string | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  contact: { firstName?: string | null; lastName?: string | null; phone: string };
  steps: Array<{ nodeId: string; status: string; branchTaken?: string | null; error?: string | null }>;
  testMode?: boolean;
};

type ExecutionDetail = {
  path: Array<{
    nodeId: string;
    label: string;
    blockType?: string;
    status: string;
    branchTaken?: string | null;
    error?: string | null;
  }>;
};

export function AutomationExecutionHistory({ flowId }: { flowId: string }) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);

  useEffect(() => {
    fetch(`/api/automations/${flowId}/executions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setExecutions(json.data);
      })
      .finally(() => setLoading(false));
  }, [flowId]);

  async function loadDetail(executionId: string) {
    if (expandedId === executionId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(executionId);
    const res = await fetch(`/api/automations/${flowId}/executions/${executionId}`);
    const json = await res.json();
    if (json?.data) setDetail({ path: json.data.path });
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading history…</p>;

  if (!executions.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No execution history yet. Publish the automation and trigger it to see runs here.
      </p>
    );
  }

  return (
    <Card>
      <CardTitle>Execution history</CardTitle>
      <Table className="mt-4">
        <THead>
          <TR>
            <TH>Customer</TH>
            <TH>Started</TH>
            <TH>Status</TH>
            <TH>Current step</TH>
            <TH>Completed</TH>
            <TH>Error</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {executions.map((ex) => (
            <>
              <TR key={ex.id}>
                <TD>
                  {ex.contact.firstName} {ex.contact.lastName}
                  <span className="block text-xs text-muted-foreground">{ex.contact.phone}</span>
                </TD>
                <TD className="text-muted-foreground whitespace-nowrap">
                  {new Date(ex.startedAt).toLocaleString()}
                </TD>
                <TD>
                  <StatusChip
                    status={
                      ex.status === "COMPLETED"
                        ? "Completed"
                        : ex.status === "FAILED"
                          ? "Failed"
                          : ex.status === "WAITING"
                            ? "Pending"
                            : ex.status === "CANCELLED"
                              ? "Canceled"
                              : "Active"
                    }
                  />
                  {ex.testMode ? <span className="ml-1 text-xs text-muted-foreground">(test)</span> : null}
                </TD>
                <TD className="text-muted-foreground text-xs">{ex.currentNodeId || "—"}</TD>
                <TD className="text-muted-foreground whitespace-nowrap">
                  {ex.completedAt ? new Date(ex.completedAt).toLocaleString() : "—"}
                </TD>
                <TD className="text-rose-600 text-xs max-w-[160px] truncate">{ex.error || "—"}</TD>
                <TD>
                  <Button variant="outline" size="sm" onClick={() => loadDetail(ex.id)}>
                    {expandedId === ex.id ? "Hide" : "Path"}
                  </Button>
                </TD>
              </TR>
              {expandedId === ex.id && detail ? (
                <TR key={`${ex.id}-detail`}>
                  <TD colSpan={7} className="bg-muted/30">
                    <ol className="space-y-2 py-2 text-sm">
                      {detail.path.map((step, i) => (
                        <li key={step.nodeId} className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{i + 1}. {step.label}</span>
                          <StatusChip status={step.status === "completed" ? "Completed" : step.status === "failed" ? "Failed" : "Pending"} />
                          {step.branchTaken ? (
                            <span className="text-xs text-muted-foreground">
                              Branch: {step.branchTaken === "yes" ? "Yes" : step.branchTaken === "no" ? "No" : step.branchTaken}
                            </span>
                          ) : null}
                          {step.error ? <span className="text-xs text-rose-600">{step.error}</span> : null}
                        </li>
                      ))}
                    </ol>
                  </TD>
                </TR>
              ) : null}
            </>
          ))}
        </TBody>
      </Table>
    </Card>
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
    const res = await fetch(`/api/automations/${flowId}/publish`, { method: "POST", body: JSON.stringify({}) });
    if (!res.ok) {
      const json = await res.json();
      alert(json.error || "Publish failed");
      return;
    }
    window.location.reload();
  }

  if (status === "Draft") {
    return (
      <>
        <Button onClick={() => publish()}>Activate flow</Button>
        <a href={`/automations/${flowId}/edit`}>
          <Button variant="outline">Edit in builder</Button>
        </a>
      </>
    );
  }
  if (status === "Paused") {
    return <Button onClick={() => patch("resume")}>Resume</Button>;
  }
  return (
    <>
      <Button variant="outline" onClick={() => patch("pause")}>Pause</Button>
      <a href={`/automations/${flowId}/edit`}>
        <Button variant="outline">Edit in builder</Button>
      </a>
    </>
  );
}
