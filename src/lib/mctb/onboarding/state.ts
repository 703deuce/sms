import { getPrisma } from "@/lib/db";
import { emitPlatformEvent } from "@/lib/platform/events";
import type { MctbFunnelEventKey } from "./funnel";
import {
  DEFAULT_ONBOARDING_MESSAGE,
  type MctbOnboardingState,
  type MctbOnboardingStep,
  MCTB_ONBOARDING_STEP_ORDER,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const LEGACY_STEP_MAP: Record<string, MctbOnboardingStep> = {
  compliance: "tfv",
};

export function defaultMctbOnboardingState(): MctbOnboardingState {
  return {
    version: 2,
    currentStep: "business",
    completedSteps: [],
    startedAt: new Date().toISOString(),
    messageTemplate: DEFAULT_ONBOARDING_MESSAGE,
    consentMode: "press_1",
    trialNumber: null,
    demoSession: null,
    liveTestSession: null,
    funnelEvents: {},
  };
}

function normalizeStep(step: unknown): MctbOnboardingStep {
  const raw = String(step || "business");
  return LEGACY_STEP_MAP[raw] || (raw as MctbOnboardingStep);
}

export function parseMctbOnboardingState(raw: unknown): MctbOnboardingState {
  const stored = asRecord(asRecord(raw).mctbOnboarding);
  if (!stored.version) return defaultMctbOnboardingState();
  return {
    ...defaultMctbOnboardingState(),
    ...(stored as unknown as MctbOnboardingState),
    version: 2,
    currentStep: normalizeStep(stored.currentStep),
    completedSteps: Array.isArray(stored.completedSteps)
      ? (stored.completedSteps as string[]).map(normalizeStep)
      : [],
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
  const next: MctbOnboardingState = {
    ...current,
    ...patch,
    completedSteps: patch.completedSteps ?? current.completedSteps,
    funnelEvents: { ...current.funnelEvents, ...(patch.funnelEvents || {}) },
  };
  const customFieldsConfig = {
    ...asRecord(ws?.customFieldsConfig),
    mctbOnboarding: next,
  };
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

export function isOnboardingComplete(state: MctbOnboardingState): boolean {
  return Boolean(state.trialActivatedAt) || state.currentStep === "complete";
}

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
