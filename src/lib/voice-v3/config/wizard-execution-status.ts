/** How a wizard field maps into runtime for the current milestone. */
export type WizardV3ExecutionStatus =
  | "ACTIVE_EXECUTION"
  | "CONFIGURED_NOT_IMPLEMENTED"
  | "CONTROL_PLANE_ONLY"
  | "PROVIDER_CONFIG"
  | "UNSUPPORTED_BY_CURRENT_LIVE_API";

export type WizardV3RepublishBehavior =
  | "next_call"
  | "active_call_unchanged"
  | "control_plane_only";
