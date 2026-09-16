"use client";

import { Button } from "@/components/ui/button";
import {
  applyWizardPreset,
  createDefaultWizardState,
} from "@/lib/solutions/appointment-receptionist/defaults";
import {
  visibleWizardSteps,
  wizardHeadline,
  hireWizardHeadline,
  AMY_FIXED_CAPABILITIES,
} from "@/lib/solutions/appointment-receptionist/wizard-presets";
import { type AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { toErrorMessage } from "@/lib/errors";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  mctbVisibleWizardSteps,
  stepIndexFromQuery,
  stepQueryFromIndex,
} from "@/lib/mctb/voice-agent/wizard-steps";
import { computeMctbWizardStepReadiness } from "@/lib/mctb/voice-agent/step-readiness";
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
import { wizardPatchFromCompanyBrain } from "@/lib/solutions/appointment-receptionist/hydrate-from-brain";

const STORAGE_KEY_LEGACY = "transovo.appointment-receptionist.wizard.v1";
const STORAGE_KEY_MCTB = "transovo.mctb.voice-agent.wizard.v1";

export type AppointmentReceptionistWizardProps = {
  presentation?: "legacy" | "mctb";
  onAgentStatusChange?: (status: "draft" | "active" | "needs_attention" | null) => void;
  onAgentIdChange?: (agentId: string | null) => void;
};

function mctbDefaultState(): AppointmentReceptionistWizardState {
  const base = applyWizardPreset(createDefaultWizardState(), "after_hours");
  return {
    ...base,
    solutionName: "After-Hours Voice Agent",
    role: "After-hours voice agent",
  };
}

export function AppointmentReceptionistWizard({
  presentation = "legacy",
  onAgentStatusChange,
  onAgentIdChange,
}: AppointmentReceptionistWizardProps) {
  const isMctb = presentation === "mctb";
  const storageKey = isMctb ? STORAGE_KEY_MCTB : STORAGE_KEY_LEGACY;
  const router = useRouter();
  const searchParams = useSearchParams();
  const preset = searchParams?.get("preset");
  const hireMode = !isMctb && searchParams?.get("hire") === "amy";
  const [stepIndex, setStepIndex] = useState(0);
  const [agentLifecycle, setAgentLifecycle] = useState<"draft" | "active" | null>(null);
  const [hasCalendarConnection, setHasCalendarConnection] = useState(false);
  const [state, setState] = useState<AppointmentReceptionistWizardState>(() => {
    if (isMctb) return mctbDefaultState();
    const base = applyWizardPreset(createDefaultWizardState(), preset);
    if (hireMode) {
      return {
        ...base,
        capabilities: [
          ...AMY_FIXED_CAPABILITIES,
          ...(base.capabilities.includes("reschedule") ? (["reschedule"] as const) : []),
          ...(base.capabilities.includes("cancel") ? (["cancel"] as const) : []),
        ],
        agentName: "Amy",
        solutionName: "Amy — Appointment Booking Agent",
        role: "Appointment booking agent",
      };
    }
    return base;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    onAgentIdChange?.(state.agentId || null);
  }, [state.agentId, onAgentIdChange]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const setupId = searchParams?.get("setupId");
        const agentId = searchParams?.get("agentId");
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
              const base = isMctb
                ? mctbDefaultState()
                : applyWizardPreset(
                    createDefaultWizardState(),
                    preset || loaded.state.preset || null,
                  );
              setState({
                ...base,
                ...loaded.state,
                setupId: loaded.setupId || undefined,
                agentId: loaded.agentId || loaded.state.agentId,
                outcomeSlug: loaded.outcomeSlug || loaded.state.outcomeSlug,
                preset: isMctb
                  ? loaded.state.preset || "after_hours"
                  : preset || loaded.state.preset || null,
              });
              const statusRaw = String(loaded.status || loaded.agentStatus || "").toUpperCase();
              const life =
                statusRaw === "ACTIVE" ? "active" : statusRaw === "DRAFT" ? "draft" : null;
              setAgentLifecycle(life);
              onAgentStatusChange?.(
                life === "active"
                  ? "active"
                  : life === "draft"
                    ? "draft"
                    : "needs_attention",
              );
              const fromUrl = stepIndexFromQuery(
                searchParams?.get("step"),
                mctbVisibleWizardSteps(loaded.state),
              );
              setStepIndex(fromUrl ?? 0);
              setHydrated(true);
              return;
            }
          }
        }

        const raw = localStorage.getItem(storageKey);
        if (preset && !isMctb) {
          setState(
            applyWizardPreset({ ...createDefaultWizardState(), preset }, preset),
          );
          setStepIndex(0);
        } else if (raw) {
          const parsed = JSON.parse(raw) as {
            stepIndex?: number;
            state?: AppointmentReceptionistWizardState;
          };
          const draftPreset = parsed.state?.preset || null;
          const answeringDraft =
            !isMctb &&
            (draftPreset === "every_call" ||
              draftPreset === "nobody_answers" ||
              draftPreset === "after_hours" ||
              draftPreset === "lead_capture" ||
              draftPreset === "service_intake");
          if (answeringDraft || !parsed.state) {
            setState(isMctb ? mctbDefaultState() : createDefaultWizardState());
            setStepIndex(0);
          } else {
            setState({
              ...(isMctb ? mctbDefaultState() : createDefaultWizardState()),
              ...parsed.state,
            });
            if (typeof parsed.stepIndex === "number") {
              setStepIndex(Math.min(Math.max(parsed.stepIndex, 0), 7));
            }
          }
        } else {
          setState(isMctb ? mctbDefaultState() : createDefaultWizardState());
          setStepIndex(0);
        }

        if (isMctb) {
          const fromUrl = stepIndexFromQuery(
            searchParams?.get("step"),
            mctbVisibleWizardSteps(state),
          );
          if (fromUrl !== null) setStepIndex(fromUrl);
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
  }, [preset, searchParams, hireMode, isMctb, storageKey, onAgentStatusChange]);

  useEffect(() => {
    if (!hydrated || !hireMode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/company-brain", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const brainPatch = wizardPatchFromCompanyBrain(json?.data);
        if (Object.keys(brainPatch).length) {
          setState((prev) => ({ ...prev, ...brainPatch }));
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, hireMode]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ stepIndex, state }));
    } catch {
      // ignore quota
    }
  }, [hydrated, stepIndex, state, storageKey]);

  useEffect(() => {
    if (!hydrated || !isMctb) return;
    void (async () => {
      try {
        const [calRes, intRes] = await Promise.all([
          fetch("/api/integrations/calendars"),
          fetch("/api/integrations/connections"),
        ]);
        const calJson = await calRes.json().catch(() => ({ data: [] }));
        const intJson = await intRes.json().catch(() => ({ data: {} }));
        const rows = (calJson.data || []) as Array<{ status?: string }>;
        const connections = (intJson.data?.connections || []) as Array<{
          provider?: string;
          status?: string;
        }>;
        const liveCal = rows.some((r) => r.status === "connected" || r.status === "active");
        const liveInt = connections.some(
          (c) =>
            (c.provider === "microsoft" || c.provider === "calendly") &&
            (c.status === "connected" || c.status === "active"),
        );
        setHasCalendarConnection(liveCal || liveInt || state.calendarConnected);
      } catch {
        setHasCalendarConnection(state.calendarConnected);
      }
    })();
  }, [hydrated, isMctb, state.calendarConnected]);

  const patch = useCallback((p: Partial<AppointmentReceptionistWizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  const steps = useMemo(
    () =>
      isMctb
        ? mctbVisibleWizardSteps(state)
        : visibleWizardSteps(state, {
            hireMode,
            brainAlreadyDone: hireMode,
          }),
    [state, hireMode, isMctb],
  );

  const stepStatuses = useMemo(
    () =>
      isMctb
        ? computeMctbWizardStepReadiness(state, {
            hasCalendarConnection,
            agentStatus: agentLifecycle === "active" ? "active" : agentLifecycle,
          })
        : undefined,
    [isMctb, state, hasCalendarConnection, agentLifecycle],
  );

  const headline = useMemo(() => {
    if (isMctb) {
      return {
        title: "After-Hours Voice Agent",
        subtitle:
          "Answer missed and after-hours calls with an AI agent that follows your business rules.",
      };
    }
    return hireMode
      ? hireWizardHeadline(state.agentName || "Amy")
      : wizardHeadline(state.preset || preset);
  }, [hireMode, state.agentName, state.preset, preset, isMctb]);

  useEffect(() => {
    setStepIndex((i) => Math.min(i, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  function postSavePath(agentId: string, step?: string) {
    if (isMctb) {
      const params = new URLSearchParams();
      if (step) params.set("step", step);
      params.set("agentId", agentId);
      return `${MCTB_ROUTES.voiceAgent}?${params.toString()}`;
    }
    return hireMode ? `/agents/${agentId}` : `/voice/agents/${agentId}`;
  }

  async function persist(
    action: "save_draft" | "activate" | "create_draft",
    stateOverride?: Partial<AppointmentReceptionistWizardState>,
  ) {
    setBusy(true);
    setError("");
    const payload = stateOverride ? { ...state, ...stateOverride } : state;
    try {
      const res = await fetch("/api/solutions/appointment-receptionist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          state: payload,
          wizardStepId: steps[stepIndex]?.id,
        }),
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
      const setupId = (json.data.setupId as string | undefined) || payload.setupId;
      const outcomeSlug =
        (json.data.outcomeSlug as string | undefined) || payload.outcomeSlug;
      const telnyxAssistantId =
        (json.data.telnyxAssistantId as string | null | undefined) ??
        payload.telnyxAssistantId;
      const clonedAgentId = (json.data.clonedAgentId as string | null | undefined) || null;
      const warnings = Array.isArray(json.data.warnings)
        ? (json.data.warnings as string[]).filter(Boolean)
        : [];
      patch({
        agentId,
        setupId,
        outcomeSlug,
        telnyxAssistantId,
        preset: isMctb ? payload.preset || "after_hours" : preset || payload.preset || null,
        ...(stateOverride || {}),
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
        if (!json.data.published && payload.activationMode === "schedule") {
          localStorage.removeItem(storageKey);
          router.push(postSavePath(agentId, "activate"));
          return { agentId, telnyxAssistantId, clonedAgentId };
        }
        if (json.data.published) {
          setAgentLifecycle("active");
          onAgentStatusChange?.("active");
        }
        if (isMctb) {
          router.push(postSavePath(agentId, "activate"));
          return { agentId, telnyxAssistantId, clonedAgentId };
        }
        localStorage.removeItem(storageKey);
        router.push(postSavePath(agentId));
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

  const goToStep = useCallback(
    (index: number) => {
      const next = Math.min(Math.max(index, 0), steps.length - 1);
      setStepIndex(next);
      if (isMctb) {
        const q = stepQueryFromIndex(next, steps);
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.set("step", q);
        if (state.agentId) params.set("agentId", state.agentId);
        router.replace(`${MCTB_ROUTES.voiceAgent}?${params.toString()}`, { scroll: false });
      }
    },
    [isMctb, router, searchParams, state.agentId, steps],
  );

  async function onContinue() {
    if (stepIndex < steps.length - 1) {
      if (stepIndex === 0 && !state.agentId) {
        const created = await persist("create_draft");
        if (!created?.agentId) return;
      }
      if (steps[stepIndex + 1]?.id === "test") {
        const saved = await persist("save_draft");
        if (!saved?.agentId) return;
      }
      goToStep(stepIndex + 1);
      return;
    }
    if (state.activationMode === "save_draft") {
      const saved = await persist("save_draft");
      if (saved?.agentId) {
        if (!isMctb) localStorage.removeItem(storageKey);
        router.push(postSavePath(saved.agentId, isMctb ? "activate" : undefined));
      }
      return;
    }
    if (state.activationMode === "schedule" && !state.scheduledAt?.trim()) {
      setError(
        "Pick a schedule date/time, or choose Save as draft. Saving as draft for now…",
      );
      const saved = await persist("save_draft");
      if (saved?.agentId) {
        if (!isMctb) localStorage.removeItem(storageKey);
        router.push(postSavePath(saved.agentId, isMctb ? "activate" : undefined));
      }
      return;
    }
    await persist("activate");
  }

  async function onSaveDraft() {
    await persist("save_draft");
  }

  const step = steps[stepIndex];
  const stepPresentation = isMctb ? "mctb" : "legacy";

  return (
    <div
      className={
        isMctb
          ? "mctb-va-wizard flex flex-col"
          : "flex min-h-[calc(100vh-7rem)] flex-col"
      }
    >
      {!isMctb ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {headline.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{headline.subtitle}</p>
          </div>
        </div>
      ) : null}

      {isMctb ? (
        <p className="mctb-va-mobile-step" aria-live="polite">
          Step {stepIndex + 1} of {steps.length} · {step?.label}
        </p>
      ) : null}

      <div
        className={
          isMctb
            ? "mctb-va-stepper-wrap"
            : "mb-6 rounded-xl border border-border bg-card px-3 py-4 sm:px-5"
        }
      >
        <WizardStepper
          steps={steps}
          currentIndex={stepIndex}
          presentation={presentation}
          stepStatuses={stepStatuses}
          onStepSelect={isMctb ? goToStep : undefined}
        />
      </div>

      <div className="flex-1">
        {step?.id === "goals" ? (
          <GoalsStep
            state={state}
            patch={patch}
            hireMode={hireMode}
            presentation={stepPresentation}
          />
        ) : null}
        {step?.id === "phone" ? (
          <PhoneStep state={state} patch={patch} presentation={stepPresentation} />
        ) : null}
        {step?.id === "information" ? (
          <InformationStep state={state} patch={patch} presentation={stepPresentation} />
        ) : null}
        {step?.id === "appointments" ? (
          <AppointmentsStep state={state} patch={patch} presentation={stepPresentation} />
        ) : null}
        {step?.id === "call-handling" ? (
          <CallHandlingStep state={state} patch={patch} presentation={stepPresentation} />
        ) : null}
        {step?.id === "voice" ? (
          <VoiceStep state={state} patch={patch} presentation={stepPresentation} />
        ) : null}
        {step?.id === "test" ? (
          <TestStep
            state={state}
            patch={patch}
            onEnsureAgent={ensureAgentForTest}
            presentation={stepPresentation}
          />
        ) : null}
        {step?.id === "activate" ? (
          <ActivateStep
            state={state}
            patch={patch}
            presentation={stepPresentation}
            onActivate={() => void persist("activate", { activationMode: "activate_now" })}
            onGoToTest={() => {
              const testIdx = steps.findIndex((s) => s.id === "test");
              if (testIdx >= 0) goToStep(testIdx);
            }}
          />
        ) : null}
      </div>

      <div
        className={
          isMctb
            ? "mctb-va-footer sticky bottom-0 z-20 mt-6"
            : "sticky bottom-0 z-20 -mx-4 mt-6 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mt-8 lg:rounded-xl lg:border lg:px-5"
        }
      >
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={stepIndex === 0 || busy}
            onClick={() => goToStep(stepIndex - 1)}
          >
            Back
          </Button>
          <div className="flex flex-1 flex-col items-end gap-1 sm:flex-row sm:items-center sm:justify-end">
            {error ? (
              <p className="max-w-md text-right text-xs text-danger sm:mr-3">{error}</p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={() => void onSaveDraft()}>
                {isMctb ? "Save" : "Save draft"}
              </Button>
              <Button
                className={isMctb ? "btn-primary-mctb" : undefined}
                data-testid={
                  stepIndex === steps.length - 1 ? "wizard-activate-footer" : "wizard-continue"
                }
                disabled={busy}
                onClick={() => void onContinue()}
              >
                {busy
                  ? "Working…"
                  : stepIndex === steps.length - 1
                    ? state.activationMode === "save_draft"
                      ? "Save draft"
                      : state.activationMode === "schedule"
                        ? "Schedule activation"
                        : state.activationMode === "duplicate_location"
                          ? "Activate & duplicate"
                          : hireMode
                            ? "Put Amy to work"
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
