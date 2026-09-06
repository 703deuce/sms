"use client";

import { PrebuiltWorkflowCard } from "@/components/appointments/workflows-client";
import { Input } from "@/components/ui/input";
import { PREBUILT_WORKFLOW_TEMPLATES } from "@/lib/appointment-workflows/templates";
import type { AppointmentWorkflowRecord } from "@/lib/appointment-workflows/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AutomationsTemplatesClient() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<AppointmentWorkflowRecord[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/appointments/workflows")
      .then((r) => r.json())
      .then((json) => setWorkflows(json.data?.workflows || []))
      .catch(() => {});
  }, []);

  const installedByTemplate = new Map(
    workflows.filter((w) => w.templateId).map((w) => [w.templateId!, w]),
  );
  const query = search.trim().toLowerCase();
  const filteredTemplates = query
    ? PREBUILT_WORKFLOW_TEMPLATES.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query),
      )
    : PREBUILT_WORKFLOW_TEMPLATES;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recommended appointment workflows you can install in one click.
          </p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="sm:w-64"
        />
      </div>

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

      <p className="text-[13px] text-muted-foreground">
        Need a custom flow?{" "}
        <Link href="/appointments/workflows/new" className="font-medium text-primary hover:underline">
          Create a workflow
        </Link>
        .
      </p>
    </div>
  );
}
