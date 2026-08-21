import type { MctbOnboardingState, MctbTrialNumberInfo } from "./onboarding/types";

/** Canonical workspace-owned toll-free number (provisioned during onboarding). */
export type MctbWorkspaceTollFreeInfo = MctbTrialNumberInfo;

/** @deprecated Use workspaceTollFreeNumber — subscription is in trial, the number is not. */
export type MctbTrialNumberInfoAlias = MctbWorkspaceTollFreeInfo;

/** Read the workspace toll-free number from onboarding state (canonical + legacy field). */
export function getWorkspaceTollFreeNumber(
  state: Pick<MctbOnboardingState, "workspaceTollFreeNumber" | "trialNumber">,
): MctbWorkspaceTollFreeInfo | null | undefined {
  return state.workspaceTollFreeNumber ?? state.trialNumber ?? null;
}

/** Patch helper — writes canonical field and mirrors legacy trialNumber for backward compat. */
export function withWorkspaceTollFreeNumber(
  state: MctbOnboardingState,
  info: MctbWorkspaceTollFreeInfo | null | undefined,
): Partial<MctbOnboardingState> {
  return {
    workspaceTollFreeNumber: info ?? null,
    trialNumber: info ?? null,
  };
}

export function normalizeWorkspaceTollFreeFields(
  stored: Record<string, unknown>,
): Pick<MctbOnboardingState, "workspaceTollFreeNumber" | "trialNumber"> {
  const canonical =
    (stored.workspaceTollFreeNumber as MctbWorkspaceTollFreeInfo | null | undefined) ??
    (stored.trialNumber as MctbWorkspaceTollFreeInfo | null | undefined) ??
    null;
  return {
    workspaceTollFreeNumber: canonical,
    trialNumber: canonical,
  };
}
