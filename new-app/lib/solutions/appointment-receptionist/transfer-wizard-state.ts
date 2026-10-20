import { createId } from "@/lib/supabase/id";
import type { AppointmentReceptionistWizardState } from "./types";
import {
  normalizeWizardTransferPhone,
  wizardTransferDestinationName,
} from "./transfer-utils";

export const TRANSFER_RING_SECONDS_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;

/** Client-safe validation messages (no server-only compile / LiveKit imports). */
export type TransferWizardValidationIssue = { id: string; message: string };

export type WizardTransferDestinationRow = NonNullable<
  AppointmentReceptionistWizardState["transferDestinations"]
>[number];

export type WizardTransferPlanStep = NonNullable<
  AppointmentReceptionistWizardState["transferPlanSteps"]
>[number];

function legacyDestinationRow(
  state: AppointmentReceptionistWizardState,
): WizardTransferDestinationRow | null {
  const phone = normalizeWizardTransferPhone(state.transferDestinationPhone);
  if (!phone) return null;
  return {
    id: state.transferDestinations?.[0]?.id || "default_transfer",
    label: wizardTransferDestinationName(state.transferDestinationName),
    phoneE164: phone,
    enabled: true,
  };
}

/** Ensure destinations + plan steps exist; migrate legacy single-destination fields. */
export function ensureEmergencyTransferWizardState(
  state: AppointmentReceptionistWizardState,
): AppointmentReceptionistWizardState {
  let destinations = [...(state.transferDestinations ?? [])].filter((d) => d?.id);
  const legacy = legacyDestinationRow(state);

  if (destinations.length === 0 && legacy) {
    destinations = [legacy];
  }

  if (destinations.length > 0 && legacy) {
    const first = destinations[0];
    const legacyName = state.transferDestinationName?.trim();
    const legacyPhone = normalizeWizardTransferPhone(state.transferDestinationPhone);
    if (
      legacyName &&
      !destinations.some((d) => d.label === legacyName) &&
      first &&
      first.label === wizardTransferDestinationName("")
    ) {
      destinations[0] = { ...first, label: wizardTransferDestinationName(legacyName) };
    }
    if (legacyPhone && first && !normalizeWizardTransferPhone(first.phoneE164)) {
      destinations[0] = { ...first, phoneE164: legacyPhone };
    }
  }

  const enabledDests = destinations.filter((d) => d.enabled !== false);
  let steps = [...(state.transferPlanSteps ?? [])];
  const destIds = new Set(enabledDests.map((d) => d.id));

  steps = steps.filter((s) => destIds.has(s.destinationId));

  for (const d of enabledDests) {
    if (!steps.some((s) => s.destinationId === d.id)) {
      steps.push({
        destinationId: d.id,
        transferMode: state.warmTransfer ? "WARM" : "BASIC",
        timeoutSeconds: state.transferRingSeconds ?? 30,
        order: steps.length + 1,
      });
    }
  }

  steps = steps
    .map((s, i) => ({
      ...s,
      order: s.order ?? i + 1,
      timeoutSeconds: clampRingSeconds(s.timeoutSeconds ?? state.transferRingSeconds ?? 30),
      transferMode: s.transferMode ?? (state.warmTransfer ? "WARM" : "BASIC"),
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s, i) => ({ ...s, order: i + 1 }));

  const routing = state.transferRouting === "waterfall" ? "waterfall" : "single";
  if (routing === "single" && steps.length > 1) {
    // Keep all steps for when user switches to waterfall; compiler uses first only.
  }

  return {
    ...state,
    transferDestinations: destinations,
    transferPlanSteps: steps,
    transferRouting: routing,
  };
}

export function syncLegacyTransferFieldsFromDestinations(
  state: AppointmentReceptionistWizardState,
): Partial<AppointmentReceptionistWizardState> {
  const normalized = ensureEmergencyTransferWizardState(state);
  const first = normalized.transferDestinations?.find((d) => d.enabled !== false);
  if (!first) {
    return {
      transferDestinations: normalized.transferDestinations,
      transferPlanSteps: normalized.transferPlanSteps,
    };
  }
  return {
    transferDestinations: normalized.transferDestinations,
    transferPlanSteps: normalized.transferPlanSteps,
    transferDestinationName: first.label,
    transferDestinationPhone: first.phoneE164,
  };
}

export function clampRingSeconds(seconds: number): number {
  const n = Math.round(Number(seconds));
  if (!Number.isFinite(n)) return 30;
  return Math.min(120, Math.max(5, n));
}

export function newTransferDestinationId(): string {
  return `xfer_${createId()}`;
}

export function addTransferDestination(
  state: AppointmentReceptionistWizardState,
  input?: { label?: string; phoneE164?: string },
): Partial<AppointmentReceptionistWizardState> {
  const base = ensureEmergencyTransferWizardState(state);
  const id = newTransferDestinationId();
  const destinations = [
    ...(base.transferDestinations ?? []),
    {
      id,
      label: input?.label?.trim() || "New contact",
      phoneE164: input?.phoneE164?.trim() || "",
      enabled: true,
    },
  ];
  const steps = [
    ...(base.transferPlanSteps ?? []),
    {
      destinationId: id,
      order: (base.transferPlanSteps?.length ?? 0) + 1,
      transferMode: "BASIC" as const,
      timeoutSeconds: clampRingSeconds(base.transferRingSeconds ?? 30),
    },
  ];
  return syncLegacyTransferFieldsFromDestinations({
    ...base,
    transferDestinations: destinations,
    transferPlanSteps: steps,
  });
}

export function removeTransferDestination(
  state: AppointmentReceptionistWizardState,
  destinationId: string,
): Partial<AppointmentReceptionistWizardState> {
  const base = ensureEmergencyTransferWizardState(state);
  const destinations = (base.transferDestinations ?? []).filter((d) => d.id !== destinationId);
  const steps = (base.transferPlanSteps ?? [])
    .filter((s) => s.destinationId !== destinationId)
    .map((s, i) => ({ ...s, order: i + 1 }));
  return syncLegacyTransferFieldsFromDestinations({
    ...base,
    transferDestinations: destinations,
    transferPlanSteps: steps,
  });
}

export function moveTransferPlanStep(
  state: AppointmentReceptionistWizardState,
  destinationId: string,
  direction: "up" | "down",
): Partial<AppointmentReceptionistWizardState> {
  const base = ensureEmergencyTransferWizardState(state);
  const steps = [...(base.transferPlanSteps ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const index = steps.findIndex((s) => s.destinationId === destinationId);
  if (index < 0) return {};
  const swap = direction === "up" ? index - 1 : index + 1;
  if (swap < 0 || swap >= steps.length) return {};
  const next = [...steps];
  [next[index], next[swap]] = [next[swap], next[index]];
  const reordered = next.map((s, i) => ({ ...s, order: i + 1 }));
  return syncLegacyTransferFieldsFromDestinations({
    ...base,
    transferPlanSteps: reordered,
  });
}

export function updateTransferDestination(
  state: AppointmentReceptionistWizardState,
  destinationId: string,
  patch: Partial<WizardTransferDestinationRow>,
): Partial<AppointmentReceptionistWizardState> {
  const base = ensureEmergencyTransferWizardState(state);
  const destinations = (base.transferDestinations ?? []).map((d) =>
    d.id === destinationId ? { ...d, ...patch } : d,
  );
  return syncLegacyTransferFieldsFromDestinations({
    ...base,
    transferDestinations: destinations,
  });
}

export function updateTransferPlanStep(
  state: AppointmentReceptionistWizardState,
  destinationId: string,
  patch: Partial<WizardTransferPlanStep>,
): Partial<AppointmentReceptionistWizardState> {
  const base = ensureEmergencyTransferWizardState(state);
  const steps = (base.transferPlanSteps ?? []).map((s) => {
    if (s.destinationId !== destinationId) return s;
    const next = { ...s, ...patch };
    if ("timeoutSeconds" in patch) {
      next.timeoutSeconds =
        patch.timeoutSeconds === undefined
          ? undefined
          : clampRingSeconds(patch.timeoutSeconds ?? base.transferRingSeconds ?? 30);
    }
    return next;
  });
  return syncLegacyTransferFieldsFromDestinations({
    ...base,
    transferPlanSteps: steps,
  });
}

export function transferWizardValidationIssues(
  state: AppointmentReceptionistWizardState,
): TransferWizardValidationIssue[] {
  if (!state.capabilities.includes("transfer_calls")) return [];
  const normalized = ensureEmergencyTransferWizardState(state);
  if (normalized.voiceV2HumanTransferEnabled === false) return [];

  const local: TransferWizardValidationIssue[] = [];
  const dests = (normalized.transferDestinations ?? []).filter((d) => d.enabled !== false);
  if (!dests.length) {
    local.push({
      id: "transfer_ui_no_destinations",
      message: "Add at least one emergency transfer contact with a valid phone number.",
    });
  }
  for (const d of dests) {
    if (!normalizeWizardTransferPhone(d.phoneE164)) {
      local.push({
        id: `transfer_ui_bad_phone_${d.id}`,
        message: `"${d.label || "Contact"}" needs a valid phone number (E.164 or US 10-digit).`,
      });
    }
  }
  const ids = new Set<string>();
  for (const d of dests) {
    if (ids.has(d.id)) {
      local.push({ id: "transfer_ui_duplicate_id", message: "Duplicate transfer contact ids." });
    }
    ids.add(d.id);
  }
  const destIdSet = new Set(dests.map((d) => d.id));
  for (const s of normalized.transferPlanSteps ?? []) {
    if (!destIdSet.has(s.destinationId)) {
      local.push({
        id: `transfer_ui_orphan_step_${s.destinationId}`,
        message: "Transfer order references a removed contact — save again to repair.",
      });
    }
  }
  if (
    normalized.transferRouting === "waterfall" &&
    dests.filter((d) => normalizeWizardTransferPhone(d.phoneE164)).length < 2
  ) {
    local.push({
      id: "transfer_ui_waterfall_min",
      message: "Waterfall routing needs at least two valid contacts.",
    });
  }

  const defaultRing = clampRingSeconds(normalized.transferRingSeconds ?? 30);
  if (defaultRing < 5 || defaultRing > 120) {
    local.push({
      id: "transfer_ui_bad_default_timeout",
      message: "Default ring timeout must be between 5 and 120 seconds.",
    });
  }
  for (const s of normalized.transferPlanSteps ?? []) {
    const t = s.timeoutSeconds;
    if (t != null && (t < 5 || t > 120)) {
      local.push({
        id: `transfer_ui_bad_timeout_${s.destinationId}`,
        message: "Ring timeout for each contact must be between 5 and 120 seconds.",
      });
    }
  }

  const hasWarmStep = (normalized.transferPlanSteps ?? []).some((s) => s.transferMode === "WARM");
  if (hasWarmStep) {
    local.push({
      id: "transfer_ui_warm_requires_platform",
      message:
        "Warm transfer requires outbound telephony on your account. Activation will block if platform warm transfer is not configured.",
    });
  }

  return local;
}
