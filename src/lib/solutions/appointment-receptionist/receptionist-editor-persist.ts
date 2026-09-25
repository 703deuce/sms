import type { AppointmentReceptionistWizardState, WizardPersistAction } from "./types";
import {
  OWNERSHIP_TO_WIZARD_STEP,
  type ReceptionistOwnershipGroup,
  RECEPTIONIST_OWNERSHIP_GROUPS,
} from "./receptionist-editor-ownership";

export type PersistReceptionistDraftResult = {
  ok: boolean;
  agentId?: string;
  warnings: string[];
  failedGroups: ReceptionistOwnershipGroup[];
  savedGroups: ReceptionistOwnershipGroup[];
  error?: string;
};

/**
 * Persist dirty ownership groups sequentially (each response is authoritative for the next merge).
 */
export async function persistReceptionistDraftGroups(input: {
  state: AppointmentReceptionistWizardState;
  dirtyGroups: ReceptionistOwnershipGroup[];
  action?: WizardPersistAction;
}): Promise<PersistReceptionistDraftResult> {
  const action = input.action ?? "save_draft";
  const order = RECEPTIONIST_OWNERSHIP_GROUPS.filter((g) => input.dirtyGroups.includes(g));
  const warnings: string[] = [];
  const savedGroups: ReceptionistOwnershipGroup[] = [];
  const failedGroups: ReceptionistOwnershipGroup[] = [];

  let state = input.state;
  let agentId = state.agentId;

  for (const group of order) {
    const wizardStepId = OWNERSHIP_TO_WIZARD_STEP[group];
    try {
      const res = await fetch("/api/solutions/appointment-receptionist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          state,
          wizardStepId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        failedGroups.push(group);
        return {
          ok: false,
          agentId,
          warnings,
          failedGroups,
          savedGroups,
          error:
            json.error ||
            `Save failed for ${group} (${wizardStepId})`,
        };
      }
      agentId = (json.data?.agentId as string) || agentId;
      if (Array.isArray(json.data?.warnings)) {
        warnings.push(...(json.data.warnings as string[]).filter(Boolean));
      }
      savedGroups.push(group);
      state = { ...state, agentId };
    } catch (err) {
      failedGroups.push(group);
      return {
        ok: false,
        agentId,
        warnings,
        failedGroups,
        savedGroups,
        error: err instanceof Error ? err.message : "Save failed",
      };
    }
  }

  return {
    ok: true,
    agentId,
    warnings,
    failedGroups,
    savedGroups,
  };
}

export async function persistReceptionistActivate(
  state: AppointmentReceptionistWizardState,
): Promise<{
  ok: boolean;
  agentId?: string;
  published?: boolean;
  error?: string;
  warnings: string[];
}> {
  const res = await fetch("/api/solutions/appointment-receptionist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "activate",
      state: { ...state, activationMode: "activate_now", scheduledAt: null },
    }),
  });
  const json = await res.json();
  const warnings = Array.isArray(json.data?.warnings)
    ? (json.data.warnings as string[]).filter(Boolean)
    : [];
  if (!res.ok) {
    return {
      ok: false,
      agentId: json.data?.agentId,
      error: json.error || "Activation failed",
      warnings,
    };
  }
  return {
    ok: true,
    agentId: json.data?.agentId as string,
    published: Boolean(json.data?.published),
    warnings,
  };
}
