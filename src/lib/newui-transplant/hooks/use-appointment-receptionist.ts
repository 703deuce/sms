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
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
      );
      const qs = new URLSearchParams();
      if (params.get("setupId")) qs.set("setupId", params.get("setupId")!);
      if (params.get("agentId")) qs.set("agentId", params.get("agentId")!);
      const res = await fetch(
        `/api/solutions/appointment-receptionist${qs.toString() ? `?${qs.toString()}` : ""}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const json = await res.json();
      const loaded = json?.data;
      if (loaded?.state || loaded?.agentId) {
        const serverState =
          loaded.state && typeof loaded.state === "object" ? loaded.state : {};
        setState({
          ...baseState(),
          ...serverState,
          agentId: loaded.agentId || serverState.agentId,
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
    const ensured = await ensureReceptionistAgentId(state);
    if (!ensured.ok) throw new Error(ensured.error || "Could not create draft agent");
    const result = await persistKnowledgeWizardStep({
      state: ensured.state,
      wizardStepId: "knowledge",
    });
    if (!result.ok) throw new Error(result.error || "Save failed");
    await reload();
  }, [state, reload]);

  return { state, patch, loading, reload, saveDraft, saveKnowledge, agentStatus };
}
