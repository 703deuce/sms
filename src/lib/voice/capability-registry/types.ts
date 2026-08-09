import type { z } from "zod";

/** Side-effect classification for guards and confirmation policy. */
export type CapabilitySideEffectLevel = "read" | "write" | "transfer" | "end";

export type CapabilityConfirmationPolicy =
  | "never"
  | "optional"
  | "required_before_execute";

export type CapabilityDefinition = {
  /** Stable id, e.g. calendar.check_availability */
  id: string;
  description: string;
  /** Model-facing tool name(s) this capability exposes. */
  toolNames: readonly string[];
  sideEffectLevel: CapabilitySideEffectLevel;
  confirmationPolicy: CapabilityConfirmationPolicy;
  /** Task ids that may invoke this capability (runtime guard — not tool visibility). */
  allowedInNodeTypes: readonly string[];
};

export type CapabilityToolBinding = {
  capabilityId: string;
  toolName: string;
};
