"use client";

import { wizardStateFromDraftConfig } from "@/lib/receptionist-wizard/load-config";
import { advancedFromDraftConfig } from "@/lib/receptionist-wizard/load-advanced";
import type { ReceptionistAdvancedSettings } from "@/lib/receptionist-wizard/advanced-types";
import { RECEPTIONIST_ADVANCED_KEY } from "@/lib/receptionist-wizard/advanced-types";
import type { ReceptionistWizardState, CollectFieldId } from "@/lib/receptionist-wizard/types";
import {
  applyCompiledToVoiceConfig,
  compileReceptionistConfig,
  type ReceptionistDraftInput,
} from "@/lib/voice/receptionist/compile";
import { collectFieldIdsFromRows } from "@/lib/voice/receptionist/field-manifest";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  LIVEKIT_AGENT_TEMPLATE_KEY,
  normalizeAgentTemplateId,
} from "@/lib/voice/templates/agent-template-config";
import { useCallback, useEffect, useState } from "react";

export function useReceptionistAgentState(agentId: string) {
  const [state, setState] = useState<ReceptionistWizardState | null>(null);
  const [advanced, setAdvanced] = useState<ReceptionistAdvancedSettings | null>(null);
  const [advancedSnapshot, setAdvancedSnapshot] = useState<ReceptionistAdvancedSettings | null>(
    null,
  );
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
        const wizard = wizardStateFromDraftConfig(
          j.data.draftConfig,
          agentId,
          j.data.displayName || j.data.name,
        );
        setState(wizard);
        const adv = advancedFromDraftConfig(j.data.draftConfig, wizard.capabilities);
        setAdvanced(adv);
        setAdvancedSnapshot(adv);
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

  const patchAdvanced = useCallback((patch: Partial<ReceptionistAdvancedSettings>) => {
    setAdvanced((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const discardAdvanced = useCallback(() => {
    if (advancedSnapshot) setAdvanced(advancedSnapshot);
  }, [advancedSnapshot]);

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
    if (!state || !advanced) return;
    const next = { ...state, ...partial, agentId };
    const nextAdvanced = advanced;
    const collectFields: CollectFieldId[] =
      next.capabilities.includes("collect_info")
        ? collectFieldIdsFromRows(nextAdvanced.callerFields) as CollectFieldId[]
        : next.collectFields;

    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/voice/agents/${agentId}`);
      const j = await res.json();
      const prev = parseVoiceAgentConfig(j.data?.draftConfig);
      const advancedBlock = {
        [RECEPTIONIST_ADVANCED_KEY]: nextAdvanced,
        conversationBehavior: nextAdvanced.conversationBehavior,
        bookingPolicy: nextAdvanced.bookingPolicy,
        transferPolicy: nextAdvanced.transferPolicy,
        knowledgePolicy: nextAdvanced.knowledgePolicy,
        actionPermissions: nextAdvanced.actionPermissions,
        fallbackPolicy: nextAdvanced.fallbackPolicy,
        notifications: nextAdvanced.notifications,
        voiceV2Intake: nextAdvanced.voiceV2Intake,
        receptionistWizard: {
          agentName: next.agentName,
          businessName: next.businessName,
          industry: next.industry,
          businessDescription: next.businessDescription,
          agentPersonalityNotes: next.agentPersonalityNotes,
          agentJobInstructions: next.agentJobInstructions,
          additionalInstructions: next.additionalInstructions,
          businessHours: next.businessHours,
          serviceArea: next.serviceArea,
          coreServices: next.coreServices,
          pricingNotes: next.pricingNotes,
          importantFacts: next.importantFacts,
          businessAddress: next.businessAddress,
          answerTiming: next.answerTiming,
          greeting: next.greeting,
          language: next.language,
          timezone: next.timezone,
          capabilities: next.capabilities,
          collectFields,
          voiceId: next.voiceId,
          voiceLabel: next.voiceLabel,
          voiceSpeed: next.voiceSpeed,
          elevenLabsStability: next.elevenLabsStability,
          elevenLabsClarity: next.elevenLabsClarity,
          elevenLabsStyle: next.elevenLabsStyle,
          elevenLabsSpeakerBoost: next.elevenLabsSpeakerBoost,
          elevenLabsOptimizeLatency: next.elevenLabsOptimizeLatency,
          vadThreshold: next.vadThreshold,
          vadSilenceMs: next.vadSilenceMs,
          vadPrefixMs: next.vadPrefixMs,
          livekitAgentTemplate: normalizeAgentTemplateId(next.livekitAgentTemplate),
        },
        realtimeVad: {
          threshold: next.vadThreshold,
          silenceDurationMs: next.vadSilenceMs,
          prefixPaddingMs: next.vadPrefixMs,
        },
      };
      const draftInput: ReceptionistDraftInput = {
        agentName: next.agentName,
        businessName: next.businessName,
        businessDescription: next.businessDescription,
        agentJobInstructions: next.agentJobInstructions,
        agentPersonalityNotes: next.agentPersonalityNotes,
        industry: next.industry,
        additionalInstructions: next.additionalInstructions,
        greeting: next.greeting,
        language: next.language,
        timezone: next.timezone,
        answerTiming: next.answerTiming,
        capabilities: next.capabilities,
        collectFields,
        voiceId: next.voiceId,
        voiceLabel: next.voiceLabel,
        advanced: advancedBlock,
      };
      const snapshot = compileReceptionistConfig(draftInput);
      const merged = applyCompiledToVoiceConfig(prev, snapshot);
      const draftConfig = {
        ...merged,
        voiceLanguage: {
          ...merged.voiceLanguage,
          voiceId: next.voiceId,
          primaryLanguage: next.language,
          speed: next.voiceSpeed,
          elevenLabsTuning: true,
          elevenLabsStability: next.elevenLabsStability,
          elevenLabsSimilarityBoost: next.elevenLabsClarity,
          elevenLabsStyle: next.elevenLabsStyle,
          elevenLabsSpeakerBoost: next.elevenLabsSpeakerBoost,
        },
        advanced: {
          ...(merged.advanced as object),
          ...advancedBlock,
          [LIVEKIT_AGENT_TEMPLATE_KEY]: normalizeAgentTemplateId(next.livekitAgentTemplate),
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
      setState({ ...next, collectFields });
      setAdvancedSnapshot(nextAdvanced);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      throw err;
    } finally {
      setBusy(false);
    }
  }, [agentId, state, advanced]);

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
    advanced,
    agentName,
    phoneNumberId,
    phoneE164,
    rawStatus,
    loading,
    busy,
    error,
    setError,
    patch,
    patchAdvanced,
    discardAdvanced,
    save,
    assignPhone,
    buildForTest,
    publish,
  };
}
