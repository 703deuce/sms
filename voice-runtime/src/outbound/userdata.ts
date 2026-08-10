import type {
  LeadQualificationResult,
  OutboundJobMetadata,
  QualificationBusinessOutcome,
  QualificationDefinition,
} from "@/lib/voice/outbound/types";
import type { OutboundCallMission } from "@/lib/voice/outbound/compile-outbound-call-context";

export type OutboundLeadUserData = {
  workspaceId: string;
  agentId: string;
  callId: string;
  businessName: string;
  timezone: string;
  job: OutboundJobMetadata;
  qualification: QualificationDefinition;
  mission: OutboundCallMission;
  /** Authoritative collected field values. */
  collectedFields: Record<string, string>;
  explicitOutcome?: QualificationBusinessOutcome | null;
  interested: boolean;
  qualificationComplete: boolean;
  result?: LeadQualificationResult;
  firstAudioAt?: number;
  callAnsweredAt?: number;
};

export function isOutboundLeadUserData(value: unknown): value is OutboundLeadUserData {
  return Boolean(
    value &&
      typeof value === "object" &&
      "job" in value &&
      (value as OutboundLeadUserData).job?.kind === "outbound_lead_qualification",
  );
}

export function isOutboundLeadQualificationProfile(
  advanced: Record<string, unknown> | undefined,
): boolean {
  return String(advanced?.livekitProfile || "").trim().toLowerCase() === "outbound_lead_qualification";
}
