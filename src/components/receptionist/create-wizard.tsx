"use client";

import { wizardStateToDraftConfig } from "@/lib/receptionist-wizard/build-config";
import {
  createDefaultWizardState,
} from "@/lib/receptionist-wizard/defaults";
import { WIZARD_STEPS } from "@/lib/receptionist-wizard/types";
import type { ReceptionistWizardState } from "@/lib/receptionist-wizard/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReceptionistWizardStepper } from "./wizard-stepper";
import { AboutStep } from "./steps/about-step";
import { CapabilitiesStep } from "./steps/capabilities-step";
import { VoiceTestStep } from "./steps/voice-test-step";
import { HelpCircle } from "lucide-react";

const STORAGE_KEY = "transovo.receptionist.wizard.v1";

export function ReceptionistCreateWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<ReceptionistWizardState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw).state as ReceptionistWizardState;
    } catch {
      // ignore
    }
    return createDefaultWizardState();
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function patch(p: Partial<ReceptionistWizardState>) {
    setState((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ stepIndex, state: next }),
        );
      } catch {
        // ignore
      }
      return next;
    });
  }

  async function ensureAgentDraft(): Promise<string> {
    if (state.agentId) return state.agentId;
    const name = state.agentName.trim() || "Amy";
    const res = await fetch("/api/voice/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${name} — ${state.businessName.trim() || "Receptionist"}`,
        templateId: "receptionist",
        description: state.businessDescription.trim(),
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create agent");
    const agentId = json.data.id as string;
    const draftConfig = wizardStateToDraftConfig({ ...state, agentId });
    const patchRes = await fetch(`/api/voice/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${name} — ${state.businessName.trim() || "Receptionist"}`,
        draftConfig,
      }),
    });
    const patchJson = await patchRes.json();
    if (!patchRes.ok) throw new Error(patchJson.error || "Failed to save agent");
    const buildRes = await fetch(`/api/voice/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "build_for_test" }),
    });
    if (!buildRes.ok) {
      const bj = await buildRes.json();
      throw new Error(bj.error || "Failed to prepare test build");
    }
    patch({ agentId });
    return agentId;
  }

  async function goToCapabilities() {
    setError("");
    if (!state.businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    setStepIndex(1);
  }

  async function goToVoiceTest() {
    setError("");
    setBusy(true);
    try {
      await ensureAgentDraft();
      setStepIndex(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    setError("");
    setBusy(true);
    try {
      const agentId = await ensureAgentDraft();
      const publishRes = await fetch(`/api/voice/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      const publishJson = await publishRes.json();
      if (!publishRes.ok) {
        // Draft save still succeeded — go to editor even if publish fails
        console.warn(publishJson.error || "Publish failed");
      }
      localStorage.removeItem(STORAGE_KEY);
      router.push(`/voice/agents/${agentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/voice/agents"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back to Agents
        </Link>
        <Link
          href="/help"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
          Help Center
        </Link>
      </div>

      <div className="mb-8">
        <ReceptionistWizardStepper
          steps={WIZARD_STEPS.map((s) => ({ id: s.id, label: s.label }))}
          currentIndex={stepIndex}
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {stepIndex === 0 ? (
        <AboutStep
          state={state}
          patch={patch}
          onContinue={goToCapabilities}
          onCancel={() => router.push("/voice/agents")}
          busy={busy}
        />
      ) : null}

      {stepIndex === 1 ? (
        <CapabilitiesStep
          state={state}
          patch={patch}
          onBack={() => setStepIndex(0)}
          onContinue={goToVoiceTest}
          busy={busy}
        />
      ) : null}

      {stepIndex === 2 ? (
        <VoiceTestStep
          state={state}
          patch={patch}
          onBack={() => setStepIndex(1)}
          onActivate={activate}
          busy={busy}
        />
      ) : null}
    </div>
  );
}
