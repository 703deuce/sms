"use client";

import { ReceptionistEditorShell } from "@/components/receptionist/receptionist-editor-shell";
import { AboutStep } from "@/components/receptionist/steps/about-step";
import { createDefaultWizardState } from "@/lib/receptionist-wizard/defaults";
import {
  applyCompiledToVoiceConfig,
  compileReceptionistConfig,
} from "@/lib/voice/receptionist/compile";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type { ReceptionistWizardState } from "@/lib/receptionist-wizard/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateReceptionistPage() {
  const router = useRouter();
  const [state, setState] = useState<ReceptionistWizardState>(createDefaultWizardState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function patch(p: Partial<ReceptionistWizardState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  async function continueToCapabilities() {
    setError("");
    if (!state.businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    setBusy(true);
    try {
      const name = state.agentName.trim() || "Amy";
      const res = await fetch("/api/voice/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${name} — ${state.businessName.trim()}`,
          templateId: "receptionist",
          description: state.businessDescription.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create agent");
      const agentId = json.data.id as string;
      const prev = parseVoiceAgentConfig(null);
      const snapshot = compileReceptionistConfig({
        agentName: state.agentName,
        businessName: state.businessName,
        businessDescription: state.businessDescription,
        agentJobInstructions: state.agentJobInstructions,
        agentPersonalityNotes: state.agentPersonalityNotes,
        industry: state.industry,
        additionalInstructions: state.additionalInstructions,
        greeting: state.greeting,
        language: state.language,
        timezone: state.timezone,
        answerTiming: state.answerTiming,
        capabilities: state.capabilities,
        collectFields: state.collectFields,
        voiceId: state.voiceId,
        advanced: {
          receptionistWizard: {
            ...state,
          },
          livekitAgentTemplate: state.livekitAgentTemplate,
        },
      });
      const draftConfig = applyCompiledToVoiceConfig(prev, snapshot);
      await fetch(`/api/voice/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: json.data.name, draftConfig }),
      });
      router.push(`/voice/agents/${agentId}/capabilities`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ReceptionistEditorShell createMode>
      {error ? (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      <AboutStep
        state={state}
        patch={patch}
        onContinue={continueToCapabilities}
        onCancel={() => router.push("/voice/receptionist")}
        busy={busy}
      />
    </ReceptionistEditorShell>
  );
}
