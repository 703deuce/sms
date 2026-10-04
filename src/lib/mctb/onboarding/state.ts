import { getPrisma } from "@/lib/db";
import { emitPlatformEvent } from "@/lib/platform/events";
import type { MctbFunnelEventKey } from "./funnel";
import {
  DEFAULT_ONBOARDING_MESSAGE,
  type MctbOnboardingState,
  type MctbOnboardingStep,
  MCTB_ONBOARDING_STEP_ORDER,
} from "./types";
import {
  normalizeCompletedSteps,
  normalizeOnboardingStep,
} from "@/lib/mctb/onboarding/wizard-flow";
import { normalizeWorkspaceTollFreeFields } from "@/lib/mctb/workspace-toll-free";

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Drop undefined values so json/jsonb columns accept nested onboarding state. */
function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function defaultMctbOnboardingState(): MctbOnboardingState {
  return {
    version: 2,
    currentStep: "business_line",
    completedSteps: [],
    startedAt: new Date().toISOString(),
    messageTemplate: DEFAULT_ONBOARDING_MESSAGE,
    consentMode: "press_1",
    trialNumber: null,
    workspaceTollFreeNumber: null,
    demoSession: null,
    liveTestSession: null,
    funnelEvents: {},
  };
}

function normalizeStep(step: unknown): MctbOnboardingStep {
  const raw = String(step || "business_line");
  if (raw === "compliance") return "recovery";
  return normalizeOnboardingStep(raw);
}

export function parseMctbOnboardingState(raw: unknown): MctbOnboardingState {
  const stored = asRecord(asRecord(raw).mctbOnboarding);
  if (!stored.version) return defaultMctbOnboardingState();
  const tollFreeFields = normalizeWorkspaceTollFreeFields(stored);
  return {
    ...defaultMctbOnboardingState(),
    ...(stored as unknown as MctbOnboardingState),
    ...tollFreeFields,
    version: 2,
    currentStep: normalizeStep(stored.currentStep),
    completedSteps: normalizeCompletedSteps(stored.completedSteps),
    funnelEvents:
      stored.funnelEvents && typeof stored.funnelEvents === "object"
        ? (stored.funnelEvents as Record<string, string>)
        : {},
    // Migrate legacy compliance timestamps
    tfvSubmittedAt:
      (stored.tfvSubmittedAt as string) ||
      (stored.complianceSubmittedAt as string) ||
      null,
    tfvApprovedAt:
      (stored.tfvApprovedAt as string) ||
      (stored.complianceApprovedAt as string) ||
      null,
  };
}

export async function loadMctbOnboardingState(
  workspaceId: string,
): Promise<MctbOnboardingState> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  return parseMctbOnboardingState(ws?.customFieldsConfig);
}

export async function saveMctbOnboardingState(
  workspaceId: string,
  patch: Partial<MctbOnboardingState>,
): Promise<MctbOnboardingState> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const current = parseMctbOnboardingState(ws?.customFieldsConfig);
  const tollFreePatch =
    patch.workspaceTollFreeNumber !== undefined || patch.trialNumber !== undefined
      ? normalizeWorkspaceTollFreeFields({
          workspaceTollFreeNumber: patch.workspaceTollFreeNumber ?? patch.trialNumber,
          trialNumber: patch.trialNumber ?? patch.workspaceTollFreeNumber,
        })
      : {};
  const next: MctbOnboardingState = {
    ...current,
    ...patch,
    ...tollFreePatch,
    completedSteps: patch.completedSteps ?? current.completedSteps,
    funnelEvents: { ...current.funnelEvents, ...(patch.funnelEvents || {}) },
  };
  const baseCfg = asRecord(ws?.customFieldsConfig);
  const mctb =
    baseCfg.mctb && typeof baseCfg.mctb === "object"
      ? (baseCfg.mctb as Record<string, unknown>)
      : {};
  const onboardingRaw = asRecord(baseCfg.mctbOnboarding);
  const onboardingExplicitConsent =
    typeof onboardingRaw.consentMode === "string" && onboardingRaw.consentMode.length > 0;
  const consentStepComplete = next.completedSteps.includes("consent");
  const shouldMirrorConsentToMctb =
    Boolean(patch.consentMode) ||
    consentStepComplete ||
    onboardingExplicitConsent;
  const customFieldsConfig = jsonSafe({
    ...baseCfg,
    mctbOnboarding: next,
    ...(shouldMirrorConsentToMctb
      ? { mctb: { ...mctb, consentMode: next.consentMode } }
      : {}),
  });
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { customFieldsConfig },
  });
  return next;
}

export function markStepComplete(
  state: MctbOnboardingState,
  step: MctbOnboardingStep,
): MctbOnboardingState {
  const completedSteps = state.completedSteps.includes(step)
    ? state.completedSteps
    : [...state.completedSteps, step];
  const idx = MCTB_ONBOARDING_STEP_ORDER.indexOf(step);
  const nextStep =
    idx >= 0 && idx < MCTB_ONBOARDING_STEP_ORDER.length - 1
      ? MCTB_ONBOARDING_STEP_ORDER[idx + 1]!
      : state.currentStep;
  return {
    ...state,
    completedSteps,
    currentStep: state.currentStep === step ? nextStep : state.currentStep,
  };
}

export async function recordFunnelEvent(
  workspaceId: string,
  eventKey: MctbFunnelEventKey,
  payload?: Record<string, unknown>,
): Promise<MctbOnboardingState> {
  const state = await loadMctbOnboardingState(workspaceId);
  if (state.funnelEvents?.[eventKey]) return state;

  const next = await saveMctbOnboardingState(workspaceId, {
    funnelEvents: {
      ...(state.funnelEvents || {}),
      [eventKey]: new Date().toISOString(),
    },
  });

  await emitPlatformEvent({
    workspaceId,
    type: eventKey,
    payload: { ...(payload || {}) },
    idempotencyKey: `mctb-funnel:${workspaceId}:${eventKey}`,
  }).catch(() => undefined);

  return next;
}

export { isOnboardingComplete } from "@/lib/mctb/onboarding/completion";

export function deriveOnboardingProgress(state: MctbOnboardingState) {
  const total = MCTB_ONBOARDING_STEP_ORDER.length;
  const completed = state.completedSteps.length;
  return {
    total,
    completed,
    percent: Math.round((completed / total) * 100),
    currentStep: state.currentStep,
    currentLabel: state.currentStep,
  };
}
