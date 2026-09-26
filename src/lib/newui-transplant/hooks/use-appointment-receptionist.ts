"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyWizardPreset,
  createDefaultWizardState,
} from "@/lib/solutions/appointment-receptionist/defaults";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

function baseState(): AppointmentReceptionistWizardState {
  const base = applyWizardPreset(createDefaultWizardState(), "after_hours");
  return {
    ...base,
    solutionName: "After-Hours Voice Agent",
    role: "After-hours voice agent",
  };
}

export function useAppointmentReceptionistWizard() {
  const [state, setState] = useState<AppointmentReceptionistWizardState>(baseState);
  const [loading, setLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState<string>("DRAFT");

  const patch = useCallback((p: Partial<AppointmentReceptionistWizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      let agentId: string | null = null;
      const agentsRes = await fetch("/api/voice/agents", { cache: "no-store" });
      if (agentsRes.ok) {
        const agentsJson = await agentsRes.json();
        const list = (agentsJson.data || []) as Array<{ id: string }>;
        agentId = list[0]?.id ?? null;
      }
      const qs = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
      const res = await fetch(`/api/solutions/appointment-receptionist${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      const loaded = json?.data;
      if (loaded?.state) {
        setState({
          ...baseState(),
          ...loaded.state,
          agentId: loaded.agentId || loaded.state.agentId,
          setupId: loaded.setupId || undefined,
        });
        setAgentStatus(loaded.status || "DRAFT");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveDraft = useCallback(
    async (wizardStepId = "call-handling") => {
      if (!state.agentId) throw new Error("Publish your AI agent before saving call handling.");
      const res = await fetch("/api/solutions/appointment-receptionist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          wizardStepId,
          state,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      if (json.data?.agentId) {
        setState((prev) => ({ ...prev, agentId: json.data.agentId }));
      }
    },
    [state],
  );

  const saveKnowledge = useCallback(async () => {
    const { persistKnowledgeWizardStep, ensureReceptionistAgentId } = await import(
      "@/lib/solutions/appointment-receptionist/knowledge-editor-persist"
    );
    const agentId = await ensureReceptionistAgentId(state.agentId);
    await persistKnowledgeWizardStep({ state: { ...state, agentId }, agentStatus });
    await reload();
  }, [state, agentStatus, reload]);

  return { state, patch, loading, reload, saveDraft, saveKnowledge, agentStatus };
}
