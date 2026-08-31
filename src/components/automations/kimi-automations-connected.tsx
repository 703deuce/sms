/**
 * Backend adapter shell for Kimi automations list.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WorkflowsList from "@/components/kimi/automations/WorkflowsList";
import { apiAutomationToKimi, reloadAutomations } from "@/lib/automations/kimi-automations-adapter";
import type { KimiWorkflowRow } from "@/components/kimi/automations/types";

type Props = { initialWorkflows?: KimiWorkflowRow[] };

export function KimiAutomationsConnected({ initialWorkflows = [] }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<KimiWorkflowRow[]>(initialWorkflows);
  const [loading, setLoading] = useState(initialWorkflows.length === 0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await reloadAutomations();
    setRows(data.map(apiAutomationToKimi));
  }, []);

  useEffect(() => {
    if (initialWorkflows.length > 0) return;
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [initialWorkflows.length, refresh]);

  if (loading) {
    return (
      <div className="kimi-automations px-8 py-10 text-center text-[14px] text-muted-foreground">
        Loading automations…
      </div>
    );
  }

  if (error) {
    return (
      <div className="kimi-automations px-8 py-10 text-center text-[14px] text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="kimi-automations text-foreground">
      <WorkflowsList
        workflows={rows}
        onCreate={() => router.push("/automations/new")}
        onOpen={(id) => router.push(`/automations/${id}/edit`)}
      />
    </div>
  );
}
