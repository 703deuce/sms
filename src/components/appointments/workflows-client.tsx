"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AppointmentWorkflowRecord } from "@/lib/appointment-workflows/types";
import { PREBUILT_WORKFLOW_TEMPLATES } from "@/lib/appointment-workflows/templates";
import { Sparkles } from "lucide-react";

export { AppointmentWorkflowEditor } from "@/features/appointments/kimi/workflows/workflow-editor-connected";

export function PrebuiltWorkflowCard({
  template,
  installed,
  onSetup,
}: {
  template: typeof PREBUILT_WORKFLOW_TEMPLATES[number];
  installed?: AppointmentWorkflowRecord;
  onSetup: () => void;
}) {
  return (
    <Card className="p-5 flex flex-col">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] font-semibold">{template.name}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">{template.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {template.channels.map((c) => (
              <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase">
                {c}
              </span>
            ))}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              {template.defaultSteps.length} steps
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        {installed ? (
          <span className={cn("text-xs font-semibold", installed.active ? "text-emerald-600" : "text-muted-foreground")}>
            {installed.active ? "Active" : "Inactive"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Not set up</span>
        )}
        <Button size="sm" onClick={onSetup}>
          {installed ? "Edit" : "Set up"}
        </Button>
      </div>
    </Card>
  );
}
