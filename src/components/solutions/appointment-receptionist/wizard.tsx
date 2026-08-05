"use client";

import { Button } from "@/components/ui/button";
import {
  applyWizardPreset,
  createDefaultWizardState,
} from "@/lib/solutions/appointment-receptionist/defaults";
import {
  visibleWizardSteps,
  wizardHeadline,
} from "@/lib/solutions/appointment-receptionist/wizard-presets";
import {
  type AppointmentReceptionistWizardState,
} from "@/lib/solutions/appointment-receptionist/types";
import { toErrorMessage } from "@/lib/errors";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WizardStepper } from "./wizard-stepper";
import { GoalsStep } from "./steps/goals-step";
import { PhoneStep } from "./steps/phone-step";
import { InformationStep } from "./steps/information-step";
import { AppointmentsStep } from "./steps/appointments-step";
import { CallHandlingStep } from "./steps/call-handling-step";
import { VoiceStep } from "./steps/voice-step";
import { TestStep } from "./steps/test-step";
import { ActivateStep } from "./steps/activate-step";

const STORAGE_KEY = "transovo.appointment-receptionist.wizard.v1";

export function AppointmentReceptionistWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preset = searchParams?.get("preset");
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<AppointmentReceptionistWizardState>(() =>
    applyWizardPreset(createDefaultWizardState(), preset),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const setupId = searchParams?.get("setupId");
        const agentId = searchParams?.get("agentId");
        // Server durable state wins over localStorage when reopening a setup.
        if (setupId || agentId) {
          const qs = new URLSearchParams();
          if (setupId) qs.set("setupId", setupId);
          if (agentId) qs.set("agentId", agentId);
          const res = await fetch(
            `/api/solutions/appointment-receptionist?${qs.toString()}`,
          );
          if (res.ok) {
            const json = await res.json();
            const loaded = json?.data;
            if (loaded?.state && !cancelled) {
              const base = applyWizardPreset(
                createDefaultWizardState(),
                preset || loaded.state.preset || null,
              );
              setState({
                ...base,
                ...loaded.state,
                setupId: loaded.setupId || undefined,
                agentId: loaded.agentId || loaded.state.agentId,
                outcomeSlug: loaded.outcomeSlug || loaded.state.outcomeSlug,
                preset: preset || loaded.state.preset || null,
              });
              setStepIndex(0);
              setHydrated(true);
              return;
            }
          }
        }

        const raw = localStorage.getItem(STORAGE_KEY);
        // Fresh Solutions-view presets win over a stale local draft.
        if (preset) {
          setState(
            applyWizardPreset(
              { ...createDefaultWizardState(), preset },
              preset,
            ),
          );
          setStepIndex(0);
        } else if (raw) {
          const parsed = JSON.parse(raw) as {
            stepIndex?: number;
            state?: AppointmentReceptionistWizardState;
          };
          if (parsed.state)
            setState({ ...createDefaultWizardState(), ...parsed.state });
          if (typeof parsed.stepIndex === "number") {
            setStepIndex(Math.min(Math.max(parsed.stepIndex, 0), 7));
          }
        }
      } catch {
        // ignore corrupt draft
      }
      if (!cancelled) setHydrated(true);
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [preset, searchParams]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ stepIndex, state }));
    } catch {
      // ignore quota
    }
  }, [hydrated, stepIndex, state]);

  const patch = useCallback((p: Partial<AppointmentReceptionistWizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  const steps = useMemo(() => visibleWizardSteps(state), [state]);
  const headline = useMemo(
    () => wizardHeadline(state.preset || preset),
    [state.preset, preset],
  );

  useEffect(() => {
    setStepIndex((i) => Math.min(i, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  async function persist(action: "save_draft" | "activate" | "create_draft") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/solutions/appointment-receptionist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, state }),
      });
      const json = await res.json();
      if (!res.ok) {
        const issueMsgs = Array.isArray(json?.data?.issues)
          ? (json.data.issues as Array<{ message?: string }>)
              .map((i) => i.message)
              .filter(Boolean)
              .join(" ")
          : "";
        throw new Error(issueMsgs || json.error || "Save failed");
      }
      const agentId = json.data.agentId as string;
      const setupId = (json.data.setupId as string | undefined) || state.setupId;
      const outcomeSlug =
        (json.data.outcomeSlug as string | undefined) || state.outcomeSlug;
      const telnyxAssistantId =
        (json.data.telnyxAssistantId as string | null | undefined) ?? state.telnyxAssistantId;
      const clonedAgentId = (json.data.clonedAgentId as string | null | undefined) || null;
      const warnings = Array.isArray(json.data.warnings)
        ? (json.data.warnings as string[]).filter(Boolean)
        : [];
      patch({
        agentId,
        setupId,
        outcomeSlug,
        telnyxAssistantId,
        preset: preset || state.preset || null,
      });
      if (warnings.length) {
        setError(warnings.join(" "));
      }
      if (action === "activate") {
        if (json.data.publishError) {
          setError(
            [json.data.publishError, ...warnings].filter(Boolean).join(" ") ||
              "Publish failed",
          );
          return { agentId, telnyxAssistantId, clonedAgentId };
        }
        // Schedule / draft-style activate keeps the agent and may show a warning.
        if (!json.data.published && state.activationMode === "schedule") {
          localStorage.removeItem(STORAGE_KEY);
          router.push(`/voice/agents/${agentId}`);
          return { agentId, telnyxAssistantId, clonedAgentId };
        }
        localStorage.removeItem(STORAGE_KEY);
        router.push(`/voice/agents/${agentId}`);
        return { agentId, telnyxAssistantId, clonedAgentId };
      }
      return { agentId, telnyxAssistantId, clonedAgentId };
    } catch (err) {
      setError(toErrorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function ensureAgentForTest() {
    const saved = await persist("save_draft");
    if (!saved?.agentId) return null;
    return saved;
  }

  async function onContinue() {
    if (stepIndex < steps.length - 1) {
      if (stepIndex === 0 && !state.agentId) {
        await persist("create_draft");
      }
      // Entering Test: save latest voice + config so live talk-back can build.
      if (steps[stepIndex + 1]?.id === "test") {
        await persist("save_draft");
      }
      setStepIndex((i) => i + 1);
      return;
    }
    if (state.activationMode === "save_draft") {
      const saved = await persist("save_draft");
      if (saved?.agentId) {
        localStorage.removeItem(STORAGE_KEY);
        router.push(`/voice/agents/${saved.agentId}`);
      }
      return;
    }
    if (state.activationMode === "schedule" && !state.scheduledAt?.trim()) {
      setError(
        "Pick a schedule date/time, or choose Save as draft. Saving as draft for now…",
      );
      const saved = await persist("save_draft");
      if (saved?.agentId) {
        localStorage.removeItem(STORAGE_KEY);
        router.push(`/voice/agents/${saved.agentId}`);
      }
      return;
    }
    await persist("activate");
  }

  async function onSaveDraft() {
    await persist("save_draft");
  }

  const step = steps[stepIndex];

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {headline.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{headline.subtitle}</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card px-3 py-4 sm:px-5">
        <WizardStepper steps={steps} currentIndex={stepIndex} />
      </div>

      <div className="flex-1">
        {step?.id === "goals" ? <GoalsStep state={state} patch={patch} /> : null}
        {step?.id === "phone" ? <PhoneStep state={state} patch={patch} /> : null}
        {step?.id === "information" ? (
          <InformationStep state={state} patch={patch} />
        ) : null}
        {step?.id === "appointments" ? (
          <AppointmentsStep state={state} patch={patch} />
        ) : null}
        {step?.id === "call-handling" ? (
          <CallHandlingStep state={state} patch={patch} />
        ) : null}
        {step?.id === "voice" ? <VoiceStep state={state} patch={patch} /> : null}
        {step?.id === "test" ? (
          <TestStep state={state} patch={patch} onEnsureAgent={ensureAgentForTest} />
        ) : null}
        {step?.id === "activate" ? (
          <ActivateStep
            state={state}
            patch={patch}
            onActivate={() => void persist("activate")}
            onGoToTest={() => {
              const testIdx = steps.findIndex((s) => s.id === "test");
              if (testIdx >= 0) setStepIndex(testIdx);
            }}
          />
        ) : null}
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mt-8 lg:rounded-xl lg:border lg:px-5">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={stepIndex === 0 || busy}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            Back
          </Button>
          <div className="flex flex-1 flex-col items-end gap-1 sm:flex-row sm:items-center sm:justify-end">
            {error ? (
              <p className="max-w-md text-right text-xs text-danger sm:mr-3">{error}</p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={() => void onSaveDraft()}>
                Save draft
              </Button>
              <Button disabled={busy} onClick={() => void onContinue()}>
                {busy
                  ? "Working…"
                  : stepIndex === steps.length - 1
                    ? state.activationMode === "save_draft"
                      ? "Save draft"
                      : state.activationMode === "schedule"
                        ? "Schedule activation"
                        : state.activationMode === "duplicate_location"
                          ? "Activate & duplicate"
                          : "Activate now"
                    : "Continue"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
