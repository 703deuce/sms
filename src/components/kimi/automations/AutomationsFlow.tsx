"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WorkflowsList from "./WorkflowsList";
import { apiAutomationToKimi } from "./adapters";
import type { KimiWorkflowRow } from "./types";
import { reloadAutomations } from "./wiring";

/**
 * Kimi session 2026-08-30T23-46-59-898Z-59452d — list + flow builder UI from Kimi;
 * wired to production automations APIs and useAutomationBuilder engine.
 */
export default function AutomationsFlow() {
  const router = useRouter();
  const [rows, setRows] = useState<KimiWorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await reloadAutomations();
    setRows(data.map(apiAutomationToKimi));
  }, []);

  useEffect(() => {
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [refresh]);

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
