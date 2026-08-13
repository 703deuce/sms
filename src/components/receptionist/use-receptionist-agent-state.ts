"use client";

import { wizardStateToDraftConfig } from "@/lib/receptionist-wizard/build-config";
import { wizardStateFromDraftConfig } from "@/lib/receptionist-wizard/load-config";
import type { ReceptionistWizardState } from "@/lib/receptionist-wizard/types";
import { useCallback, useEffect, useState } from "react";

export function useReceptionistAgentState(agentId: string) {
  const [state, setState] = useState<ReceptionistWizardState | null>(null);
  const [agentName, setAgentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/voice/agents/${agentId}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.data) return;
        setAgentName(j.data.name || "");
        setState(
          wizardStateFromDraftConfig(j.data.draftConfig, agentId, j.data.displayName || j.data.name),
        );
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load agent");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const patch = useCallback((p: Partial<ReceptionistWizardState>) => {
    setState((prev) => (prev ? { ...prev, ...p } : prev));
  }, []);

  const save = useCallback(async (partial?: Partial<ReceptionistWizardState>) => {
    if (!state) return;
    const next = { ...state, ...partial, agentId };
    setBusy(true);
    setError("");
    try {
      const draftConfig = wizardStateToDraftConfig(next);
      const res = await fetch(`/api/voice/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${next.agentName.trim() || "Amy"} — ${next.businessName.trim() || "Receptionist"}`,
          draftConfig,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setState(next);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      throw err;
    } finally {
      setBusy(false);
    }
  }, [agentId, state]);

  const buildForTest = useCallback(async () => {
    const res = await fetch(`/api/voice/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "build_for_test" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Build failed");
  }, [agentId]);

  const publish = useCallback(async () => {
    const res = await fetch(`/api/voice/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Publish failed");
  }, [agentId]);

  return {
    state,
    agentName,
    loading,
    busy,
    error,
    setError,
    patch,
    save,
    buildForTest,
    publish,
  };
}
