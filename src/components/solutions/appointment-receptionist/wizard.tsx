"use client";

import { pickWizardFieldComponents } from "./wizard-field-kit";
import {
  applyWizardPreset,
  createDefaultWizardState,
} from "@/lib/solutions/appointment-receptionist/defaults";
import {
  visibleWizardSteps,
  wizardHeadline,
  hireWizardHeadline,
  AMY_FIXED_CAPABILITIES,
  usesCfnaUnansweredIngressModel,
} from "@/lib/solutions/appointment-receptionist/wizard-presets";
import { type AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { toErrorMessage } from "@/lib/errors";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  mctbVisibleWizardSteps,
  stepIndexFromQuery,
  stepQueryFromIndex,
} from "@/lib/mctb/voice-agent/wizard-steps";
import {
  RECEPTIONIST_WIZARD_EDIT_PATH,
  stepIndexFromReceptionistQuery,
  receptionistStepQueryFromIndex,
} from "@/lib/voice/receptionist/wizard-step-url";
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
import { isLiveSyncPendingHealthStatus } from "@/lib/voice/agent-health-status";
import { normalizeWizardBookingStrategy } from "@/lib/solutions/appointment-receptionist/booking-strategy-ui";
import { applyMandatoryConversationGuardrails } from "@/lib/solutions/appointment-receptionist/conversation-guardrails";
import { cn } from "@/lib/utils";

const STORAGE_KEY_LEGACY = "transovo.appointment-receptionist.wizard.v1";
const STORAGE_KEY_MCTB = "transovo.mctb.voice-agent.wizard.v1";

export type AppointmentReceptionistWizardProps = {
  presentation?: "legacy" | "mctb" | "opus";
  onAgentStatusChange?: (status: "draft" | "active" | "needs_attention" | null) => void;
  onAgentIdChange?: (agentId: string | null) => void;
  onSolutionNameChange?: (solutionName: string) => void;
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
  onSolutionNameChange,
}: AppointmentReceptionistWizardProps) {
  const isMctb = presentation === "mctb";
  const isOpus = presentation === "opus";
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
  const [saveNotice, setSaveNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [savedFingerprint, setSavedFingerprint] = useState("");

  useEffect(() => {
    onAgentIdChange?.(state.agentId || null);
  }, [state.agentId, onAgentIdChange]);

  useEffect(() => {
    if (isMctb && state.solutionName?.trim()) {
      onSolutionNameChange?.(state.solutionName.trim());
    }
  }, [isMctb, state.solutionName, onSolutionNameChange]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const setupId = searchParams?.get("setupId");
        const agentId = searchParams?.get("agentId");
        const shouldLoadServer =
          Boolean(setupId || agentId) || isOpus;
        if (shouldLoadServer) {
          const qs = new URLSearchParams();
          if (setupId) qs.set("setupId", setupId);
          if (agentId) qs.set("agentId", agentId);
          const res = await fetch(
            `/api/solutions/appointment-receptionist${qs.toString() ? `?${qs.toString()}` : ""}`,
          );
          if (res.ok) {
            const json = await res.json();
            const loaded = json?.data;
            if ((loaded?.state || loaded?.agentId) && !cancelled) {
              const base = isMctb
                ? mctbDefaultState()
                : applyWizardPreset(
                    createDefaultWizardState(),
                    preset || loaded.state.preset || null,
                  );
              const serverState =
                loaded.state && typeof loaded.state === "object" ? loaded.state : {};
              const merged = {
                ...base,
                ...serverState,
                setupId: loaded.setupId || undefined,
                agentId: loaded.agentId || serverState.agentId,
                outcomeSlug: loaded.outcomeSlug || serverState.outcomeSlug,
                preset: isMctb
                  ? serverState.preset || "after_hours"
                  : preset || serverState.preset || null,
              };
              if (isMctb && loaded.agentId) {
                merged.solutionName =
                  serverState.solutionName?.trim() || merged.solutionName;
              }
              const hydratedState = applyMandatoryConversationGuardrails(
                normalizeWizardBookingStrategy(merged as AppointmentReceptionistWizardState),
              );
              setState(hydratedState);
              setSavedFingerprint(JSON.stringify(hydratedState));
              const statusRaw = String(loaded.status || loaded.agentStatus || "").toUpperCase();
              const healthStatus = String(loaded.healthStatus || "");
              const life =
                statusRaw === "ACTIVE" ? "active" : statusRaw === "DRAFT" ? "draft" : null;
              setAgentLifecycle(life);
              onAgentStatusChange?.(
                isLiveSyncPendingHealthStatus(healthStatus)
                  ? "needs_attention"
                  : life === "active"
                    ? "active"
                    : life === "draft"
                      ? "draft"
                      : "needs_attention",
              );
              if (isLiveSyncPendingHealthStatus(healthStatus)) {
                setError(
                  loaded.healthMessage?.trim() ||
                    "Saved changes are not yet applied to live calls. Save again to retry sync.",
                );
              }
              const visibleSteps = isMctb
                ? mctbVisibleWizardSteps(merged)
                : visibleWizardSteps(merged, { hireMode, brainAlreadyDone: hireMode });
              const fromUrl = isMctb
                ? stepIndexFromQuery(searchParams?.get("step"), visibleSteps)
                : isOpus
                  ? stepIndexFromReceptionistQuery(searchParams?.get("step"), visibleSteps)
                  : null;
              setStepIndex(fromUrl ?? 0);
              setHydrated(true);
              if (isOpus && merged.agentId && !searchParams?.get("agentId")) {
                const params = new URLSearchParams(searchParams?.toString() || "");
                params.set("agentId", merged.agentId);
                if (merged.setupId) params.set("setupId", merged.setupId);
                const stepQ = searchParams?.get("step");
                if (stepQ) params.set("step", stepQ);
                router.replace(`${RECEPTIONIST_WIZARD_EDIT_PATH}?${params.toString()}`, {
                  scroll: false,
                });
              }
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
        } else if (isOpus) {
          const fromUrl = stepIndexFromReceptionistQuery(
            searchParams?.get("step"),
            visibleWizardSteps(state, { hireMode, brainAlreadyDone: hireMode }),
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
  }, [preset, searchParams, hireMode, isMctb, isOpus, storageKey, onAgentStatusChange]);

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

  const fingerprintState = useCallback((s: AppointmentReceptionistWizardState) => JSON.stringify(s), []);

  const patch = useCallback((p: Partial<AppointmentReceptionistWizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  const isDirty = hydrated && fingerprintState(state) !== savedFingerprint;

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
        title: state.solutionName?.trim() || "After-Hours Voice Agent",
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

  useEffect(() => {
    if (!hydrated || !isOpus) return;
    const fromUrl = stepIndexFromReceptionistQuery(searchParams?.get("step"), steps);
    if (fromUrl !== null) {
      setStepIndex((i) => (i === fromUrl ? i : fromUrl));
    }
  }, [hydrated, isOpus, searchParams, steps]);

  useEffect(() => {
    if (!hydrated || !isOpus) return;
    if (searchParams?.get("step")) return;
    const q = receptionistStepQueryFromIndex(stepIndex, steps);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("step", q);
    if (state.agentId) params.set("agentId", state.agentId);
    if (state.setupId) params.set("setupId", state.setupId);
    router.replace(`${RECEPTIONIST_WIZARD_EDIT_PATH}?${params.toString()}`, { scroll: false });
  }, [
    hydrated,
    isOpus,
    router,
    searchParams,
    stepIndex,
    steps,
    state.agentId,
    state.setupId,
  ]);

  function postSavePath(agentId: string, step?: string) {
    if (isMctb) {
      const params = new URLSearchParams();
      if (step) params.set("step", step);
      params.set("agentId", agentId);
      return `${MCTB_ROUTES.voiceAgent}?${params.toString()}`;
    }
    if (isOpus) {
      const params = new URLSearchParams();
      params.set("agentId", agentId);
      if (step) params.set("step", step);
      return `${RECEPTIONIST_WIZARD_EDIT_PATH}?${params.toString()}`;
    }
    return hireMode ? `/agents/${agentId}` : `/voice/agents/${agentId}`;
  }

  async function persist(
    action: "save_draft" | "activate" | "create_draft",
    stateOverride?: Partial<AppointmentReceptionistWizardState>,
  ) {
    setBusy(true);
    setError("");
    setSaveNotice("");
    const payload = stateOverride ? { ...state, ...stateOverride } : state;
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 120_000);
      let res: Response;
      try {
        res = await fetch("/api/solutions/appointment-receptionist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            state: payload,
            wizardStepId: steps[stepIndex]?.id,
          }),
          signal: controller.signal,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(
            "Save timed out — the server may still be processing. Wait a moment, then try Save draft again.",
          );
        }
        throw err;
      } finally {
        window.clearTimeout(timeout);
      }
      let json: {
        error?: string;
        data?: {
          agentId?: string;
          setupId?: string;
          outcomeSlug?: string;
          telnyxAssistantId?: string | null;
          clonedAgentId?: string | null;
          warnings?: string[];
          state?: AppointmentReceptionistWizardState;
          liveSyncPending?: boolean;
          liveSyncError?: string | null;
          issues?: Array<{ message?: string }>;
          published?: boolean;
          publishError?: string | null;
        };
      };
      try {
        json = await res.json();
      } catch {
        if (!res.ok) {
          throw new Error(
            `Request failed (${res.status} ${res.statusText || "error"})`,
          );
        }
        throw new Error("Server returned an invalid response");
      }
      const liveSyncPending422 =
        res.status === 422 && json?.data?.liveSyncPending === true;
      if (!res.ok && !liveSyncPending422) {
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
      const authoritativeState = json.data?.state as
        | AppointmentReceptionistWizardState
        | undefined;
      let savedState: AppointmentReceptionistWizardState = payload;
      if (authoritativeState && typeof authoritativeState === "object") {
        savedState = {
          ...payload,
          ...authoritativeState,
          agentId,
          setupId,
          outcomeSlug,
          telnyxAssistantId,
        };
        setState(savedState);
      } else {
        savedState = {
          ...payload,
          agentId,
          setupId,
          outcomeSlug,
          telnyxAssistantId,
          preset: isMctb ? payload.preset || "after_hours" : preset || payload.preset || null,
          ...(stateOverride || {}),
        };
        setState(savedState);
      }
      setSavedFingerprint(fingerprintState(savedState));
      if (json.data?.liveSyncError || liveSyncPending422) {
        const syncMsg =
          json.data?.liveSyncError ||
          json.error ||
          "Saved, but live calls could not be updated yet.";
        const hint = Array.isArray(json.data?.warnings)
          ? (json.data.warnings as string[]).filter(Boolean).join(" ")
          : "";
        setSaveNotice([syncMsg, hint].filter(Boolean).join(" "));
        if (liveSyncPending422 && json.data?.agentId) {
          return {
            agentId: json.data.agentId as string,
            telnyxAssistantId:
              (json.data.telnyxAssistantId as string | null | undefined) ??
              payload.telnyxAssistantId,
            clonedAgentId: null,
            liveSyncPending: true,
          };
        }
        if (json.data?.liveSyncError && !liveSyncPending422) {
          return null;
        }
      }
      if (warnings.length && !liveSyncPending422 && !json.data?.liveSyncError) {
        setSaveNotice(warnings.join(" "));
      }
      if (action === "activate") {
        if (json.data.publishError) {
          setError(
            [json.data.publishError, ...warnings].filter(Boolean).join(" ") ||
              "Publish failed",
          );
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
        router.push(isOpus ? "/voice/receptionist" : postSavePath(agentId));
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
        return;
      }
      if (isOpus) {
        const q = receptionistStepQueryFromIndex(next, steps);
        const params = new URLSearchParams(searchParams?.toString() || "");
        params.set("step", q);
        if (state.agentId) params.set("agentId", state.agentId);
        if (state.setupId) params.set("setupId", state.setupId);
        router.replace(`${RECEPTIONIST_WIZARD_EDIT_PATH}?${params.toString()}`, {
          scroll: false,
        });
      }
    },
    [isMctb, isOpus, router, searchParams, state.agentId, state.setupId, steps],
  );

  const navigateToStep = useCallback(
    async (index: number, opts?: { skipSave?: boolean }) => {
      const next = Math.min(Math.max(index, 0), steps.length - 1);
      if (next === stepIndex) return;
      if (!opts?.skipSave && isDirty) {
        const saveFirst = window.confirm(
          "You have unsaved changes on this step.\n\nOK — Save draft, then continue.\nCancel — Stay on this step.",
        );
        if (!saveFirst) return;
        const saved = await persist("save_draft");
        if (!saved?.agentId) return;
      }
      goToStep(next);
    },
    [goToStep, isDirty, persist, stepIndex, steps.length],
  );

  async function onContinue() {
    if (steps[stepIndex]?.id === "goals" && state.capabilities.length === 0) {
      setError("Select at least one capability for this receptionist.");
      setSaveNotice("");
      return;
    }
    if (steps[stepIndex]?.id === "appointments") {
      const strategy =
        state.bookingStrategy ||
        normalizeWizardBookingStrategy(state).bookingStrategy ||
        "MICROSOFT_365";
      if (strategy === "SEND_LINK" && !state.bookingLinkUrl?.trim()) {
        setError("Add a booking page URL before continuing.");
        setSaveNotice("");
        return;
      }
    }
    if (stepIndex < steps.length - 1) {
      if (stepIndex === 0 && !state.agentId) {
        const created = await persist("create_draft");
        if (!created?.agentId) return;
      } else if (state.agentId) {
        const saved = await persist("save_draft");
        if (!saved?.agentId) return;
      }
      goToStep(stepIndex + 1);
      return;
    }
    await persist("activate", { activationMode: "activate_now", scheduledAt: null });
  }

  async function onSaveDraft() {
    await persist("save_draft");
  }

  const step = steps[stepIndex];
  const stepPresentation = isMctb ? "mctb" : isOpus ? "opus" : "legacy";

  const { Button: FooterButton } = pickWizardFieldComponents(stepPresentation);

  return (
    <div
      className={
        isMctb
          ? "mctb-va-wizard flex flex-col"
          : isOpus
            ? "flex flex-col"
            : "flex min-h-[calc(100vh-7rem)] flex-col"
      }
    >
      {!isMctb && !isOpus ? (
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
            : isOpus
              ? "mb-6"
              : "mb-6 rounded-xl border border-border bg-card px-3 py-4 sm:px-5"
        }
      >
        <WizardStepper
          steps={steps}
          currentIndex={stepIndex}
          presentation={presentation}
          stepStatuses={stepStatuses}
          onStepSelect={
            isMctb || isOpus
              ? (i) => void navigateToStep(i)
              : undefined
          }
        />
      </div>

      <div className={cn("flex-1", isOpus && "pb-32 sm:pb-28")}>
        {step?.id === "goals" ? (
          <GoalsStep
            state={state}
            patch={patch}
            hireMode={hireMode}
            presentation={stepPresentation}
            hideAnswerWhen={usesCfnaUnansweredIngressModel(state.preset)}
          />
        ) : null}
        {step?.id === "phone" ? (
          <PhoneStep
            state={state}
            patch={patch}
            presentation={stepPresentation}
            hideLegacyIngressControls={usesCfnaUnansweredIngressModel(state.preset)}
          />
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
              if (testIdx >= 0) void navigateToStep(testIdx);
            }}
          />
        ) : null}
      </div>

      <div
        className={
          isMctb
            ? "mctb-va-footer sticky bottom-0 z-20 mt-6"
            : isOpus
              ? "fixed bottom-0 left-0 right-0 z-50 mt-6 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:pl-[var(--sidebar-width,0px)]"
              : "sticky bottom-0 z-20 -mx-4 mt-6 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mt-8 lg:rounded-xl lg:border lg:px-5"
        }
      >
        <div
          className={
            isOpus
              ? "mx-auto flex max-w-7xl items-center justify-between gap-3"
              : "flex items-center justify-between gap-3"
          }
        >
          <FooterButton
            variant="outline"
            disabled={stepIndex === 0 || busy}
            onClick={() => void navigateToStep(stepIndex - 1)}
          >
            Back
          </FooterButton>
          <div className="flex flex-1 flex-col items-end gap-1 sm:flex-row sm:items-center sm:justify-end">
            {error || saveNotice ? (
              <p
                className={
                  error
                    ? isOpus
                      ? "max-w-md text-right text-xs text-destructive sm:mr-3"
                      : "max-w-md text-right text-xs text-danger sm:mr-3"
                    : isOpus
                      ? "max-w-md text-right text-xs text-amber-700 dark:text-amber-400 sm:mr-3"
                      : "max-w-md text-right text-xs text-amber-800 sm:mr-3"
                }
                role="status"
              >
                {error || saveNotice}
              </p>
            ) : null}
            <div className="flex gap-2">
              <FooterButton
                variant="outline"
                disabled={busy || !hydrated}
                onClick={() => void onSaveDraft()}
              >
                {isMctb ? "Save" : "Save draft"}
              </FooterButton>
              <FooterButton
                className={isMctb ? "btn-primary-mctb" : undefined}
                data-testid={
                  stepIndex === steps.length - 1 ? "wizard-activate-footer" : "wizard-continue"
                }
                disabled={busy || !hydrated}
                onClick={() => void onContinue()}
              >
                {busy
                  ? "Working…"
                  : stepIndex === steps.length - 1
                    ? hireMode
                      ? "Put Amy to work"
                      : isOpus
                        ? "Save & activate"
                        : "Activate"
                    : isOpus
                      ? "Save & continue"
                      : "Continue"}
              </FooterButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
