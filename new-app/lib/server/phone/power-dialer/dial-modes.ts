/** B8 — dialing mode taxonomy, per-mode settings, and entitlement gates. */

export type DialingMode =
  | "preview"
  | "power"
  | "parallel"
  | "parallel_amd"
  | "predictive";

export const DIALING_MODE_LABELS: Record<DialingMode, string> = {
  preview: "Preview",
  power: "Power (progressive)",
  parallel: "Parallel (2–5 lines)",
  parallel_amd: "Machine-filtered parallel",
  predictive: "Predictive",
};

export type DialModeSettings = {
  parallelLines: number;
  ringTimeoutSeconds: number;
  abandonRateTargetPct: number;
  pacingAggression: number;
  amdFilterMachines: boolean;
  predictiveMaxLines: number;
};

export const DEFAULT_DIAL_MODE_SETTINGS: DialModeSettings = {
  parallelLines: 3,
  ringTimeoutSeconds: 30,
  abandonRateTargetPct: 3,
  pacingAggression: 1,
  amdFilterMachines: true,
  predictiveMaxLines: 5,
};

export type AdvancedDialEntitlements = {
  parallelEnabled: boolean;
  predictiveEnabled: boolean;
  premiumAmdEnabled: boolean;
  maxParallelLines: number;
};

export type DialOriginationBlockReason =
  | "kill_switch"
  | "usage_limit"
  | "entitlement_parallel"
  | "entitlement_predictive"
  | "concurrency_workspace"
  | "concurrency_rep"
  | "concurrency_campaign"
  | "no_premium_amd"
  | "jurisdiction"
  | "no_available_agent"
  | "abandon_hard_stop"
  | "admin_origination_blocked";

export function normalizeDialingMode(raw: string | null | undefined): DialingMode {
  switch (raw) {
    case "preview":
    case "power":
    case "parallel":
    case "parallel_amd":
    case "predictive":
      return raw;
    default:
      return "power";
  }
}

export function isMultiLineDialMode(mode: DialingMode): boolean {
  return mode === "parallel" || mode === "parallel_amd" || mode === "predictive";
}

export function parseDialModeSettings(configJson: unknown): DialModeSettings {
  const base = { ...DEFAULT_DIAL_MODE_SETTINGS };
  if (!configJson || typeof configJson !== "object") return base;
  const o = (configJson as { dialMode?: unknown }).dialMode;
  if (!o || typeof o !== "object") return base;
  const d = o as Record<string, unknown>;
  const lines = typeof d.parallelLines === "number" ? d.parallelLines : base.parallelLines;
  return {
    parallelLines: Math.min(10, Math.max(2, Math.round(lines))),
    ringTimeoutSeconds:
      typeof d.ringTimeoutSeconds === "number"
        ? Math.min(120, Math.max(10, d.ringTimeoutSeconds))
        : base.ringTimeoutSeconds,
    abandonRateTargetPct:
      typeof d.abandonRateTargetPct === "number"
        ? Math.min(10, Math.max(0.5, d.abandonRateTargetPct))
        : base.abandonRateTargetPct,
    pacingAggression:
      typeof d.pacingAggression === "number"
        ? Math.min(3, Math.max(0.25, d.pacingAggression))
        : base.pacingAggression,
    amdFilterMachines: d.amdFilterMachines !== false,
    predictiveMaxLines:
      typeof d.predictiveMaxLines === "number"
        ? Math.min(10, Math.max(2, d.predictiveMaxLines))
        : base.predictiveMaxLines,
  };
}

export function parseAdvancedDialEntitlements(limitsRoot: unknown): AdvancedDialEntitlements {
  const root = limitsRoot && typeof limitsRoot === "object" ? (limitsRoot as Record<string, unknown>) : {};
  const pd = (root.powerDialer || {}) as Record<string, unknown>;
  const adv = (pd.advancedDialModes || {}) as Record<string, unknown>;
  const maxLines =
    typeof adv.maxParallelLines === "number" ? Math.min(10, Math.max(2, adv.maxParallelLines)) : 5;
  return {
    parallelEnabled: adv.parallelEnabled === true,
    predictiveEnabled: adv.predictiveEnabled === true,
    premiumAmdEnabled: adv.premiumAmdEnabled === true || pd.premiumAmdEnabled === true,
    maxParallelLines: maxLines,
  };
}

export function evaluateDialModeGate(input: {
  mode: DialingMode;
  entitlements: AdvancedDialEntitlements;
  abandonHardStop?: boolean;
  repAvailable?: boolean;
  jurisdictionAllowsParallel?: boolean;
}): { allowed: boolean; reason?: DialOriginationBlockReason; userMessage?: string } {
  if (input.abandonHardStop) {
    return {
      allowed: false,
      reason: "abandon_hard_stop",
      userMessage:
        "Dialing is paused because abandoned-call safeguards were exceeded. An administrator must review before resuming parallel or predictive dialing.",
    };
  }
  if (input.repAvailable === false) {
    return {
      allowed: false,
      reason: "no_available_agent",
      userMessage: "No agent is available to take a connected call. Go available or end your current call first.",
    };
  }
  if (input.jurisdictionAllowsParallel === false) {
    return {
      allowed: false,
      reason: "jurisdiction",
      userMessage: "Parallel or predictive dialing is not permitted for this campaign jurisdiction configuration.",
    };
  }
  if (input.mode === "parallel" || input.mode === "parallel_amd") {
    if (!input.entitlements.parallelEnabled) {
      return {
        allowed: false,
        reason: "entitlement_parallel",
        userMessage:
          "Parallel dialing is not enabled for this workspace. Ask an administrator to enable advanced dial modes and accept the legal notice.",
      };
    }
    if (input.mode === "parallel_amd" && !input.entitlements.premiumAmdEnabled) {
      return {
        allowed: false,
        reason: "no_premium_amd",
        userMessage: "Machine-filtered parallel dialing requires premium answering-machine detection.",
      };
    }
  }
  if (input.mode === "predictive") {
    if (!input.entitlements.predictiveEnabled) {
      return {
        allowed: false,
        reason: "entitlement_predictive",
        userMessage:
          "Predictive dialing is not enabled for this workspace. It remains off by default until an administrator enables it.",
      };
    }
    if (!input.entitlements.parallelEnabled) {
      return {
        allowed: false,
        reason: "entitlement_parallel",
        userMessage: "Predictive dialing requires parallel dial mode entitlement.",
      };
    }
  }
  return { allowed: true };
}

export function effectiveParallelLineCount(
  mode: DialingMode,
  settings: DialModeSettings,
  entitlements: AdvancedDialEntitlements,
): number {
  const cap = entitlements.maxParallelLines;
  if (mode === "predictive") {
    return Math.min(cap, settings.predictiveMaxLines, settings.parallelLines);
  }
  if (isMultiLineDialMode(mode)) {
    return Math.min(cap, settings.parallelLines);
  }
  return 1;
}
