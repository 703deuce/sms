import type { AutomationDefinition } from "@/lib/automations/types";
import type { QualificationDefinition } from "@/lib/voice/outbound/types";
import type {
  RealtorQualifiedOutcome,
  RealtorProductConfig,
} from "@/lib/realtor/types";
import type { RealEstateBusinessConfig, RealEstateFieldDefinition, RealEstateIntent } from "../types";
import type { RealEstateTemplateKey } from "../templates/definitions";

export type AgentInstanceStatus = "draft" | "testing" | "active" | "paused";

export type CompiledIntentConfig = {
  enabled: boolean;
  qualifiedOutcome: RealtorQualifiedOutcome;
  fields: RealEstateFieldDefinition[];
};

export type CompiledRealEstateIdentity = {
  agentName: string;
  companyName: string;
  brokerageName?: string;
  realtorName?: string;
  website?: string;
  businessPhone?: string;
  timezone: string;
  greeting?: string;
};

export type CompiledRealEstateVoice = {
  provider: "openai_realtime";
  model: string;
  voice: string;
  speed: number;
};

export type CompiledRealEstateFrontDesk = {
  templateKey: typeof import("../templates/definitions").REAL_ESTATE_TEMPLATE_KEYS.FRONT_DESK;
  templateVersion: number;
  configVersion: number;
  compiledAt: string;
  status: AgentInstanceStatus;
  identity: CompiledRealEstateIdentity;
  business: RealEstateBusinessConfig;
  voice: CompiledRealEstateVoice;
  intents: Record<RealEstateIntent, CompiledIntentConfig>;
  transfer: {
    enabled: boolean;
    transferNumber?: string;
  };
  booking: {
    enabled: boolean;
    appointmentTypes: string[];
    calendlyEventMappings?: Record<string, string>;
  };
  /** Visual workflow graph derived from enabled intents — not a giant prompt. */
  workflowDefinition: AutomationDefinition;
};

export type CompiledSpeedToLeadCalling = {
  callImmediately: boolean;
  leadTypes: "buyer" | "seller" | "both" | "auto_detect";
  maxAttempts: number;
  retryScheduleHours: number[];
  voicemailBehavior: "leave_message" | "hang_up";
  firstCallDelayMinutes?: number;
  callingWindowStart?: string;
  callingWindowEnd?: string;
};

export type CompiledRealEstateSpeedToLead = {
  templateKey: typeof import("../templates/definitions").REAL_ESTATE_TEMPLATE_KEYS.SPEED_TO_LEAD;
  templateVersion: number;
  configVersion: number;
  compiledAt: string;
  status: AgentInstanceStatus;
  identity: CompiledRealEstateIdentity;
  qualification: QualificationDefinition;
  calling: CompiledSpeedToLeadCalling;
  followUp: {
    useRecommended: boolean;
    qualifiedOutcome: RealtorQualifiedOutcome;
  };
  transfer: {
    enabled: boolean;
    transferNumber?: string;
  };
  booking: {
    enabled: boolean;
    calendlyEventMappings?: Record<string, string>;
  };
  workflowDefinition: AutomationDefinition;
};

export type CompileValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  path?: string;
};

export type CompileValidationResult = {
  ok: boolean;
  errors: CompileValidationIssue[];
  warnings: CompileValidationIssue[];
};

export type CompiledRealtorAgents = {
  frontDesk: CompiledRealEstateFrontDesk | null;
  speedToLead: CompiledRealEstateSpeedToLead | null;
  validation: CompileValidationResult;
  /** Monotonic version bumped on each successful compile. */
  compiledVersion: number;
};

export type PublishRealtorAgentsInput = {
  workspaceId: string;
  config: RealtorProductConfig;
  status?: AgentInstanceStatus;
};

export type PublishRealtorAgentsResult = {
  frontDeskAgentId?: string;
  outboundAgentId?: string;
  frontDeskVersionId?: string;
  outboundVersionId?: string;
  followUpAutomationId?: string;
  compiled: CompiledRealtorAgents;
};

export function templateKeyForAmyMode(
  amyMode: RealtorProductConfig["amyMode"],
): RealEstateTemplateKey[] {
  if (amyMode === "front_desk") return ["real_estate_front_desk"];
  if (amyMode === "speed_to_lead") return ["real_estate_speed_to_lead"];
  return ["real_estate_front_desk", "real_estate_speed_to_lead"];
}
