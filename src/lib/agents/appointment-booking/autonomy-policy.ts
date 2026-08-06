/**
 * Enforceable autonomy modes — product labels mapped to stored budgets.
 */

import type { AutonomyBudget } from "@/lib/agents/appointment-booking/responsibility";

/** Customer-facing autonomy mode (default Balanced). */
export type AutonomyMode = "conservative" | "balanced" | "autonomous";

export type AutonomyPermission =
  | "read_explain"
  | "create_drafts"
  | "run_simulations"
  | "safe_retries"
  | "release_expired_holds"
  | "create_manual_booking_requests"
  | "pause_optional_capabilities"
  | "switch_preapproved_fallback"
  | "apply_preapproved_repairs"
  | "emergency_rollback_under_policy"
  | "deploy_within_policy_envelope";

export const AUTONOMY_MODE_LABELS: Record<AutonomyMode, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  autonomous: "Autonomous",
};

/** Map stored budget ↔ product mode. */
export function budgetToMode(budget: AutonomyBudget | string | null | undefined): AutonomyMode {
  const b = String(budget || "standard").toLowerCase();
  if (b === "conservative") return "conservative";
  if (b === "high" || b === "autonomous") return "autonomous";
  return "balanced";
}

export function modeToBudget(mode: AutonomyMode): AutonomyBudget {
  if (mode === "conservative") return "conservative";
  if (mode === "autonomous") return "high";
  return "standard";
}

export function permissionsForMode(mode: AutonomyMode): AutonomyPermission[] {
  const base: AutonomyPermission[] = [
    "read_explain",
    "create_drafts",
    "run_simulations",
    "safe_retries",
  ];
  if (mode === "conservative") return base;
  const balanced: AutonomyPermission[] = [
    ...base,
    "release_expired_holds",
    "create_manual_booking_requests",
    "pause_optional_capabilities",
    "switch_preapproved_fallback",
  ];
  if (mode === "balanced") return balanced;
  return [
    ...balanced,
    "apply_preapproved_repairs",
    "emergency_rollback_under_policy",
    "deploy_within_policy_envelope",
  ];
}

function permissionLabel(p: AutonomyPermission): string {
  switch (p) {
    case "read_explain":
      return "Read logs, health, and explain behavior";
    case "create_drafts":
      return "Create configuration and workflow drafts";
    case "run_simulations":
      return "Run simulations and regression suites";
    case "safe_retries":
      return "Retry temporary idempotent tool failures";
    case "release_expired_holds":
      return "Release expired slot holds";
    case "create_manual_booking_requests":
      return "Create manual booking requests when calendar is down";
    case "pause_optional_capabilities":
      return "Pause broken optional capabilities (e.g. confirmation SMS)";
    case "switch_preapproved_fallback":
      return "Switch to a preapproved fallback transfer target";
    case "apply_preapproved_repairs":
      return "Apply explicitly preapproved low-risk repairs";
    case "emergency_rollback_under_policy":
      return "Emergency rollback only under approved thresholds";
    case "deploy_within_policy_envelope":
      return "Deploy only changes within a written policy envelope";
    default:
      return p;
  }
}

/** Four-bucket matrix for Permissions UI + Owner Amy explanations. */
export function autonomyPermissionBuckets(mode: AutonomyMode): {
  mayAlways: string[];
  mayAutoRepair: string[];
  mustRequestApproval: string[];
  neverAllowed: string[];
} {
  const perms = new Set(permissionsForMode(mode));
  const mayAlways = [
    "Answer approved calls",
    "Retrieve own configuration, logs, and results",
    "Run simulations",
    "Create drafts and proposals",
    "Explain failures from traces",
  ];
  const mayAutoRepair = (
    [
      "safe_retries",
      "release_expired_holds",
      "create_manual_booking_requests",
      "pause_optional_capabilities",
      "switch_preapproved_fallback",
      "apply_preapproved_repairs",
    ] as AutonomyPermission[]
  )
    .filter((p) => perms.has(p))
    .map(permissionLabel);
  const mustRequestApproval = [
    "Change live booking rules, voice, or greeting",
    "Assign a new calendar or number",
    "Modify workflow behavior / promote drafts",
    "Activate a version or duplicate into production",
  ];
  if (!perms.has("deploy_within_policy_envelope")) {
    mustRequestApproval.push("Any production deploy");
  }
  const neverAllowed = [
    "Write arbitrary code or change database schema",
    "Bypass compliance, SMS opt-out, or quiet hours",
    "Reveal credentials or access unrelated workspaces",
    "Silently broaden permissions",
    "Reconnect OAuth without the owner",
  ];
  return { mayAlways, mayAutoRepair, mustRequestApproval, neverAllowed };
}

export function describeAutonomyMode(mode: AutonomyMode): {
  mode: AutonomyMode;
  label: string;
  allowed: string[];
  forbidden: string[];
  buckets: ReturnType<typeof autonomyPermissionBuckets>;
} {
  const perms = permissionsForMode(mode);
  const allowed = perms.map(permissionLabel);
  const buckets = autonomyPermissionBuckets(mode);

  return {
    mode,
    label: AUTONOMY_MODE_LABELS[mode],
    allowed,
    forbidden: buckets.neverAllowed,
    buckets,
  };
}

/** Emergency policy: pause smallest capability. */
export type EmergencyPolicyAction = {
  trigger: string;
  action: string;
  capabilityPaused?: "booking" | "confirmationSms" | "transfers";
  alertOwner: boolean;
};

export const EMERGENCY_POLICIES: EmergencyPolicyAction[] = [
  {
    trigger: "Duplicate appointment rate exceeds threshold",
    action: "Pause booking creation; continue answering and taking requests",
    capabilityPaused: "booking",
    alertOwner: true,
  },
  {
    trigger: "Duplicate confirmation texts detected",
    action: "Pause confirmation SMS only; keep booking active",
    capabilityPaused: "confirmationSms",
    alertOwner: true,
  },
  {
    trigger: "Calendar unauthorized",
    action: "Switch to request-only mode; notify owner",
    capabilityPaused: "booking",
    alertOwner: true,
  },
  {
    trigger: "Transfer loop detected",
    action: "Disable affected transfer target; use fallback",
    capabilityPaused: "transfers",
    alertOwner: true,
  },
];
