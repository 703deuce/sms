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

export function describeAutonomyMode(mode: AutonomyMode): {
  mode: AutonomyMode;
  label: string;
  allowed: string[];
  forbidden: string[];
} {
  const perms = permissionsForMode(mode);
  const allowed = perms.map((p) => {
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
  });

  const forbidden = [
    "Reconnect OAuth without the owner",
    "Change production calendar or phone number",
    "Broaden permissions or alter compliance",
    "Launch campaigns or delete agents",
    "Activate major workflow changes without confirmation (unless policy envelope + Autonomous)",
    "Bypass SMS opt-out, quiet hours, or platform safety gates",
  ];

  return {
    mode,
    label: AUTONOMY_MODE_LABELS[mode],
    allowed,
    forbidden,
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
