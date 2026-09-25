import type { AppointmentReceptionistWizardState, WizardPersistAction, WizardStepId } from "./types";

export type PersistKnowledgeStepResult = {
  ok: boolean;
  agentId?: string;
  warnings: string[];
  error?: string;
};

export async function persistKnowledgeWizardStep(input: {
  state: AppointmentReceptionistWizardState;
  wizardStepId: WizardStepId;
  action?: WizardPersistAction;
}): Promise<PersistKnowledgeStepResult> {
  const action = input.action ?? "save_draft";
  try {
    const res = await fetch("/api/solutions/appointment-receptionist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        state: input.state,
        wizardStepId: input.wizardStepId,
      }),
    });
    const json = await res.json();
    const warnings = Array.isArray(json.data?.warnings)
      ? (json.data.warnings as string[]).filter(Boolean)
      : [];
    if (!res.ok) {
      return {
        ok: false,
        agentId: json.data?.agentId as string | undefined,
        warnings,
        error: json.error || `Save failed (${input.wizardStepId})`,
      };
    }
    return {
      ok: true,
      agentId: (json.data?.agentId as string) || input.state.agentId,
      warnings,
    };
  } catch (err) {
    return {
      ok: false,
      warnings: [],
      error: err instanceof Error ? err.message : "Save failed",
    };
  }
}

export async function ensureReceptionistAgentId(
  state: AppointmentReceptionistWizardState,
): Promise<{ ok: boolean; state: AppointmentReceptionistWizardState; error?: string }> {
  if (state.agentId) return { ok: true, state };
  const res = await fetch("/api/solutions/appointment-receptionist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "create_draft",
      state,
      wizardStepId: "goals",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    return { ok: false, state, error: json.error || "Could not create draft agent" };
  }
  const id = json.data?.agentId as string | undefined;
  if (!id) return { ok: false, state, error: "Missing agent id" };
  return { ok: true, state: { ...state, agentId: id } };
}
