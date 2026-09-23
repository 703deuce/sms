import type { ActiveCallHandler, CallHandlingPhoneSettings } from "./types";

const BLOCK_KEY = "callHandling";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function readCallHandlingBlock(settingsJson: unknown): CallHandlingPhoneSettings {
  const settings = asRecord(settingsJson);
  const block = asRecord(settings[BLOCK_KEY]);
  const raw = block.activeCallHandler;
  const activeCallHandler: ActiveCallHandler | null =
    raw === "mctb" || raw === "ai_receptionist" ? raw : null;
  const parked =
    typeof block.parkedAiReceptionistAgentId === "string"
      ? block.parkedAiReceptionistAgentId.trim() || null
      : block.parkedAiReceptionistAgentId === null
        ? null
        : undefined;
  return {
    activeCallHandler,
    parkedAiReceptionistAgentId: parked ?? null,
    explicitSelectionAt:
      typeof block.explicitSelectionAt === "string" ? block.explicitSelectionAt : null,
    lastSwitchAt: typeof block.lastSwitchAt === "string" ? block.lastSwitchAt : null,
    lastSwitchByUserId:
      typeof block.lastSwitchByUserId === "string" ? block.lastSwitchByUserId : null,
  };
}

export function hasExplicitCallHandlingSelection(settingsJson: unknown): boolean {
  const block = readCallHandlingBlock(settingsJson);
  return block.activeCallHandler !== null && Boolean(block.explicitSelectionAt);
}

export function mergeCallHandlingIntoSettings(
  settingsJson: unknown,
  patch: Partial<CallHandlingPhoneSettings>,
): Record<string, unknown> {
  const settings = asRecord(settingsJson);
  const prev = readCallHandlingBlock(settingsJson);
  const next: CallHandlingPhoneSettings = {
    ...prev,
    ...patch,
  };
  return {
    ...settings,
    [BLOCK_KEY]: {
      activeCallHandler: next.activeCallHandler,
      parkedAiReceptionistAgentId: next.parkedAiReceptionistAgentId ?? null,
      explicitSelectionAt: next.explicitSelectionAt ?? null,
      lastSwitchAt: next.lastSwitchAt ?? null,
      lastSwitchByUserId: next.lastSwitchByUserId ?? null,
    },
  };
}
