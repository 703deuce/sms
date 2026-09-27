/** How a wizard field maps into runtime for the current milestone. */
export type WizardV3ExecutionStatus =
  | "ACTIVE_EXECUTION"
  | "LIVE_PROMPT_CONTROL"
  | "ACTIVE_CONTROL_PLANE"
  | "CONFIGURED_NOT_IMPLEMENTED"
  | "CONTROL_PLANE_ONLY"
  | "PROVIDER_CONFIG"
  | "UNSUPPORTED_BY_CURRENT_LIVE_API"
  | "OUT_OF_SCOPE_RETIRED"
  | "UI_METADATA_ONLY"
  | "HIDDEN_STATE_ONLY"
  | "MCTB_ONLY"
  | "LEGACY_OBSOLETE";

export type WizardV3RepublishBehavior =
  | "next_call"
  | "active_call_unchanged"
  | "control_plane_only";
