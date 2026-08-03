/**
 * Shared types for solution capability activate hooks.
 */

export type CapabilityHookStatus =
  | "live"
  | "partial"
  | "wizard_wired"
  | "platform_ready"
  | "planned";

export type CapabilityRegistration = {
  id: string;
  status: CapabilityHookStatus;
  notes?: string;
};

export type CapabilityHookContext = {
  workspaceId: string;
  agentId: string;
  mode?: "save_draft" | "activate";
  answerWhen?: string;
  /** Optional wizard / solution metadata. */
  meta?: Record<string, unknown>;
};

export type CapabilityHookModule = {
  registerCapability: () => CapabilityRegistration;
  runActivateHooks: (ctx: CapabilityHookContext) => Promise<void>;
};
