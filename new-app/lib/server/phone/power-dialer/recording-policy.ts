import type { PowerDialerWorkspaceSettings } from "@/lib/products/power-dialer";

export type RecordingPolicy = {
  record: boolean;
  consentAnnounce: boolean;
  retentionDays: number;
  policySource: "campaign" | "workspace" | "phone_global_fallback";
};

/**
 * P23 — campaign overrides workspace; power-dialer calls never use phone-global recordCalls when campaign/workspace PD settings apply.
 */
export function mergePowerDialerRecordingPolicy(input: {
  campaignRecordingEnabled?: boolean | null;
  workspace: PowerDialerWorkspaceSettings;
  isPowerDialerCall: boolean;
  phoneGlobalRecordCalls?: boolean;
}): RecordingPolicy {
  if (!input.isPowerDialerCall) {
    return {
      record: Boolean(input.phoneGlobalRecordCalls),
      consentAnnounce: false,
      retentionDays: 365,
      policySource: "phone_global_fallback",
    };
  }
  if (typeof input.campaignRecordingEnabled === "boolean") {
    return {
      record: input.campaignRecordingEnabled,
      consentAnnounce: Boolean(input.workspace.recordingConsentAnnounce),
      retentionDays: input.workspace.recordingRetentionDays ?? 365,
      policySource: "campaign",
    };
  }
  return {
    record: input.workspace.recordingEnabled !== false,
    consentAnnounce: Boolean(input.workspace.recordingConsentAnnounce),
    retentionDays: input.workspace.recordingRetentionDays ?? 365,
    policySource: "workspace",
  };
}
