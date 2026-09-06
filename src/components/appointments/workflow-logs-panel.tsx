"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";

type LogRow = {
  id: string;
  workflowName: string;
  appointmentId: string | null;
  stepName: string;
  status: string;
  channel: string | null;
  scheduledFor: string | null;
  executedAt: string | null;
  error: string | null;
  createdAt: string;
};

export function WorkflowLogsPanel() {
  const [logs, setLogs] = useState<LogRow[]>([]);

  useEffect(() => {
    fetch("/api/appointments/workflows/logs?limit=100")
      .then((r) => r.json())
      .then((j) => setLogs(j.data || []));
  }, []);

  return (
    <Card className="p-5 mt-6">
      <CardTitle className="text-base mb-4">Workflow execution log</CardTitle>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workflow steps executed yet.</p>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="rounded-lg border px-3 py-2 text-[13px]">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{log.workflowName} · {log.stepName}</span>
                <span className="text-muted-foreground">{log.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(log.createdAt).toLocaleString()}
                {log.appointmentId ? ` · Appt ${log.appointmentId.slice(0, 8)}` : ""}
                {log.error ? ` · ${log.error}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
