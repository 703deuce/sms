/** Parsed from `phoneNumberAnsweringPolicy.scheduleJson.integratedRouting`. */
export type IntegratedRoutingConfig = {
  answeringMode?:
    | "forward"
    | "auto_attendant"
    | "conversational_ivr"
    | "staff_then_ivr"
    | "voicemail"
    | "browser";
  staffThenIvr?: {
    forwardingGroupId: string;
    ringTimeoutSec?: number;
  };
  afterHoursMode?: string;
  afterHoursMenuId?: string;
  noAnswerFallbackType?: string;
};

export function readIntegratedRouting(scheduleJson: unknown): IntegratedRoutingConfig {
  if (!scheduleJson || typeof scheduleJson !== "object") return {};
  const root = scheduleJson as Record<string, unknown>;
  const integrated =
    root.integratedRouting && typeof root.integratedRouting === "object"
      ? (root.integratedRouting as Record<string, unknown>)
      : root;
  const staff = integrated.staffThenIvr;
  return {
    answeringMode: integrated.answeringMode as IntegratedRoutingConfig["answeringMode"],
    staffThenIvr:
      staff && typeof staff === "object" && staff !== null
        ? {
            forwardingGroupId: String((staff as { forwardingGroupId?: string }).forwardingGroupId || ""),
            ringTimeoutSec: Number((staff as { ringTimeoutSec?: number }).ringTimeoutSec) || undefined,
          }
        : undefined,
    afterHoursMode: integrated.afterHoursMode ? String(integrated.afterHoursMode) : undefined,
    afterHoursMenuId: integrated.afterHoursMenuId ? String(integrated.afterHoursMenuId) : undefined,
    noAnswerFallbackType: integrated.noAnswerFallbackType
      ? String(integrated.noAnswerFallbackType)
      : undefined,
  };
}
