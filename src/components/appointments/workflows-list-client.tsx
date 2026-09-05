"use client";

import { PrebuiltWorkflowCard } from "@/components/appointments/workflows-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PREBUILT_WORKFLOW_TEMPLATES } from "@/lib/appointment-workflows/templates";
import type { AppointmentWorkflowRecord } from "@/lib/appointment-workflows/types";
import { triggerLabel } from "@/lib/appointment-workflows/labels";
import { Plus, Workflow } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function WorkflowsListClient() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<AppointmentWorkflowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/appointments/workflows")
      .then((r) => r.json())
      .then((json) => setWorkflows(json.data?.workflows || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(wf: AppointmentWorkflowRecord) {
    await fetch(`/api/appointments/workflows/${wf.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !wf.active, status: !wf.active ? "active" : "paused" }),
    });
    setWorkflows((prev) =>
      prev.map((w) => (w.id === wf.id ? { ...w, active: !w.active } : w)),
    );
  }

  async function duplicate(wf: AppointmentWorkflowRecord) {
    const res = await fetch(`/api/appointments/workflows/${wf.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate" }),
    });
    const json = await res.json();
    if (json.data) router.push(`/appointments/workflows/${json.data.id}/edit`);
  }

  async function remove(wf: AppointmentWorkflowRecord) {
    if (!confirm(`Delete "${wf.name}"?`)) return;
    await fetch(`/api/appointments/workflows/${wf.id}`, { method: "DELETE" });
    setWorkflows((prev) => prev.filter((w) => w.id !== wf.id));
  }

  const installedByTemplate = new Map(
    workflows.filter((w) => w.templateId).map((w) => [w.templateId!, w]),
  );

  const customWorkflows = workflows.filter((w) => w.sourceType === "custom" && !w.templateId);
  const query = search.trim().toLowerCase();
  const filteredWorkflows = query
    ? workflows.filter((w) => w.name.toLowerCase().includes(query) || triggerLabel(w.trigger).toLowerCase().includes(query))
    : workflows;
  const filteredTemplates = query
    ? PREBUILT_WORKFLOW_TEMPLATES.filter((t) =>
        t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query),
      )
    : PREBUILT_WORKFLOW_TEMPLATES;

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading workflows…</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automated appointment reminders, confirmations, and follow-ups.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows…"
            className="sm:w-56"
          />
          <Button asChild>
            <Link href="/appointments/workflows/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Create custom workflow
            </Link>
          </Button>
        </div>
      </div>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">Recommended workflows</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => {
            const installed = installedByTemplate.get(template.id);
            return (
              <PrebuiltWorkflowCard
                key={template.id}
                template={template}
                installed={installed}
                onSetup={() =>
                  router.push(
                    installed
                      ? `/appointments/workflows/${installed.id}/edit`
                      : `/appointments/workflows/setup/${template.id}`,
                  )
                }
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold">My workflows</h2>
        {customWorkflows.length === 0 && workflows.filter((w) => w.templateId).length === 0 ? (
          <Card className="p-8 text-center">
            <Workflow className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No custom workflows yet. Set up a recommended workflow or create your own.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredWorkflows.map((wf) => (
              <Card key={wf.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{wf.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {triggerLabel(wf.trigger)} · {wf.channels.join(", ")} · {wf.steps.length} steps
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleActive(wf)}>
                    {wf.active ? "Disable" : "Enable"}
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/appointments/workflows/${wf.id}/edit`}>Edit</Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => duplicate(wf)}>Duplicate</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(wf)}>Delete</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
