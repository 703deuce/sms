"use client";

import { UnknownRepliesPanel } from "@/components/appointments/unknown-replies-panel";
import { WorkflowLogsPanel } from "@/components/appointments/workflow-logs-panel";

export function AutomationsActivityClient() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workflow execution history and unknown customer replies.
        </p>
      </div>
      <WorkflowLogsPanel />
      <UnknownRepliesPanel />
    </div>
  );
}
