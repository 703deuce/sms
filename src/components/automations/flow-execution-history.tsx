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

export function AutomationExecutionHistory({ flowId }: { flowId: string }) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/automations/${flowId}/executions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setExecutions(json.data);
      })
      .finally(() => setLoading(false));
  }, [flowId]);

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
          </TR>
        </THead>
        <TBody>
          {executions.map((ex) => (
            <TR key={ex.id}>
              <TD>
                {ex.contact.firstName} {ex.contact.lastName}
                <span className="block text-xs text-muted-foreground">{ex.contact.phone}</span>
              </TD>
              <TD className="text-muted-foreground whitespace-nowrap">
                {new Date(ex.startedAt).toLocaleString()}
              </TD>
              <TD>
                <StatusChip status={ex.status === "COMPLETED" ? "Completed" : ex.status === "FAILED" ? "Failed" : ex.status === "WAITING" ? "Pending" : "Active"} />
                {ex.testMode ? <span className="ml-1 text-xs text-muted-foreground">(test)</span> : null}
              </TD>
              <TD className="text-muted-foreground text-xs">{ex.currentNodeId || "—"}</TD>
              <TD className="text-muted-foreground whitespace-nowrap">
                {ex.completedAt ? new Date(ex.completedAt).toLocaleString() : "—"}
              </TD>
              <TD className="text-rose-600 text-xs max-w-[200px] truncate">{ex.error || "—"}</TD>
            </TR>
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
    await fetch(`/api/automations/${flowId}/publish`, { method: "POST", body: JSON.stringify({}) });
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
