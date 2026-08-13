"use client";

import { wizardStateFromDraftConfig } from "@/lib/receptionist-wizard/load-config";
import type { ReceptionistWizardState } from "@/lib/receptionist-wizard/types";
import {
  applyCompiledToVoiceConfig,
  compileReceptionistConfig,
  type ReceptionistDraftInput,
} from "@/lib/voice/receptionist/compile";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { useCallback, useEffect, useState } from "react";

export function useReceptionistAgentState(agentId: string) {
  const [state, setState] = useState<ReceptionistWizardState | null>(null);
  const [agentName, setAgentName] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [rawStatus, setRawStatus] = useState<string>("DRAFT");
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
        setPhoneNumberId(j.data.phoneNumberId || null);
        setRawStatus(j.data.rawStatus || j.data.status || "DRAFT");
        setState(
          wizardStateFromDraftConfig(j.data.draftConfig, agentId, j.data.displayName || j.data.name),
        );
        const e164 = (j.data.draftConfig as { phoneE164?: string } | undefined)?.phoneE164;
        if (e164) setPhoneE164(e164);
        if (j.data.phoneNumberId) {
          fetch("/api/phone/numbers")
            .then((r) => r.json())
            .then((pn) => {
              const row = (pn.data || []).find(
                (p: { id: string; e164: string }) => p.id === j.data.phoneNumberId,
              );
              if (row?.e164) setPhoneE164(row.e164);
            })
            .catch(() => undefined);
        }
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

  const assignPhone = useCallback(async (nextPhoneId: string | null) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/voice/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId: nextPhoneId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Phone assignment failed");
      setPhoneNumberId(nextPhoneId);
      if (nextPhoneId) {
        const pn = await fetch("/api/phone/numbers").then((r) => r.json());
        const row = (pn.data || []).find((p: { id: string; e164: string }) => p.id === nextPhoneId);
        setPhoneE164(row?.e164 || null);
      } else {
        setPhoneE164(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Phone assignment failed");
      throw err;
    } finally {
      setBusy(false);
    }
  }, [agentId]);

  const save = useCallback(async (partial?: Partial<ReceptionistWizardState>) => {
    if (!state) return;
    const next = { ...state, ...partial, agentId };
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/voice/agents/${agentId}`);
      const j = await res.json();
      const prev = parseVoiceAgentConfig(j.data?.draftConfig);
      const advancedBase = (prev.advanced as Record<string, unknown>) ?? {};
      const draftInput: ReceptionistDraftInput = {
        agentName: next.agentName,
        businessName: next.businessName,
        businessDescription: next.businessDescription,
        greeting: next.greeting,
        language: next.language,
        timezone: next.timezone,
        answerTiming: next.answerTiming,
        capabilities: next.capabilities,
        collectFields: next.collectFields,
        voiceId: next.voiceId,
        voiceLabel: next.voiceLabel,
        advanced: {
          ...advancedBase,
          receptionistWizard: {
            agentName: next.agentName,
            businessName: next.businessName,
            businessDescription: next.businessDescription,
            answerTiming: next.answerTiming,
            greeting: next.greeting,
            language: next.language,
            timezone: next.timezone,
            capabilities: next.capabilities,
            collectFields: next.collectFields,
            voiceId: next.voiceId,
            voiceLabel: next.voiceLabel,
          },
        },
      };
      const snapshot = compileReceptionistConfig(draftInput);
      const merged = applyCompiledToVoiceConfig(prev, snapshot);
      const draftConfig = {
        ...merged,
        advanced: {
          ...(merged.advanced as object),
          receptionistWizard: draftInput.advanced?.receptionistWizard,
        },
      };
      const patchRes = await fetch(`/api/voice/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${next.agentName.trim() || "Amy"} — ${next.businessName.trim() || "Receptionist"}`,
          draftConfig,
        }),
      });
      const patchJson = await patchRes.json();
      if (!patchRes.ok) throw new Error(patchJson.error || "Save failed");
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
    setRawStatus("ACTIVE");
  }, [agentId]);

  return {
    state,
    agentName,
    phoneNumberId,
    phoneE164,
    rawStatus,
    loading,
    busy,
    error,
    setError,
    patch,
    save,
    assignPhone,
    buildForTest,
    publish,
  };
}
