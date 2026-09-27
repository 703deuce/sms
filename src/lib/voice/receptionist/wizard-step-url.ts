import {
  WIZARD_STEPS,
  type WizardStepId,
} from "@/lib/solutions/appointment-receptionist/types";

/** Canonical edit route for the 8-step Opus receptionist wizard. */
export const RECEPTIONIST_WIZARD_EDIT_PATH = "/voice/receptionist/edit";

/**
 * URL `?step=` values for `/voice/receptionist/edit`.
 * Uses wizard step ids directly (appointments = "appointments", not "booking").
 */
export const RECEPTIONIST_WIZARD_STEP_QUERY: Record<WizardStepId, string> = {
  goals: "goals",
  phone: "phone",
  information: "information",
  appointments: "appointments",
  "call-handling": "call-handling",
  voice: "voice",
  test: "test",
  activate: "activate",
};

const QUERY_TO_STEP_ID: Record<string, WizardStepId> = Object.fromEntries(
  Object.entries(RECEPTIONIST_WIZARD_STEP_QUERY).map(([id, q]) => [q, id as WizardStepId]),
) as Record<string, WizardStepId>;

/** Accept legacy MCTB alias `booking` → appointments when deep-linking. */
const QUERY_ALIASES: Record<string, WizardStepId> = {
  booking: "appointments",
};

export const RECEPTIONIST_WIZARD_NAV_ITEMS = WIZARD_STEPS.map((s) => ({
  id: s.id,
  label: s.label,
  href: receptionistEditStepHref(s.id),
}));

export function receptionistStepQueryFromId(stepId: WizardStepId): string {
  return RECEPTIONIST_WIZARD_STEP_QUERY[stepId] ?? stepId;
}

export function receptionistEditStepHref(stepId: WizardStepId): string {
  return `${RECEPTIONIST_WIZARD_EDIT_PATH}?step=${receptionistStepQueryFromId(stepId)}`;
}

export function stepIdFromReceptionistQuery(
  stepParam: string | null | undefined,
): WizardStepId | null {
  if (!stepParam?.trim()) return null;
  const key = stepParam.trim().toLowerCase();
  return QUERY_TO_STEP_ID[key] ?? QUERY_ALIASES[key] ?? null;
}

export function stepIndexFromReceptionistQuery(
  stepParam: string | null | undefined,
  steps: Array<{ id: WizardStepId }>,
): number | null {
  const id = stepIdFromReceptionistQuery(stepParam);
  if (!id) return null;
  const idx = steps.findIndex((s) => s.id === id);
  return idx >= 0 ? idx : null;
}

export function receptionistStepQueryFromIndex(
  index: number,
  steps: Array<{ id: WizardStepId }>,
): string {
  const id = steps[index]?.id;
  if (!id) return RECEPTIONIST_WIZARD_STEP_QUERY.goals;
  return receptionistStepQueryFromId(id);
}

export function isReceptionistWizardEditPath(pathname: string): boolean {
  return pathname === RECEPTIONIST_WIZARD_EDIT_PATH;
}

export function isReceptionistWizardAreaPath(pathname: string): boolean {
  return pathname === "/voice/receptionist" || pathname.startsWith("/voice/receptionist/");
}

/** Preserve agentId/setupId (and other params) when linking into the receptionist editor. */
export function buildReceptionistEditHref(
  current: URLSearchParams | string | null | undefined,
  patch: { step: WizardStepId },
): string {
  const params = new URLSearchParams(
    typeof current === "string" ? current : current?.toString() || "",
  );
  params.set("step", receptionistStepQueryFromId(patch.step));
  return `${RECEPTIONIST_WIZARD_EDIT_PATH}?${params.toString()}`;
}
