import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type { QualificationDefinition } from "./types";
import { startOutboundLeadQualificationCall } from "./outbound-call-service";

const DEFAULT_FIXTURE_PATH = path.join(
  process.cwd(),
  "scripts/fixtures/blue-ridge-realty-qualification.json",
);

export function isOutboundLeadQualificationAgent(
  config: ReturnType<typeof parseVoiceAgentConfig>,
): boolean {
  return config.advanced?.livekitProfile === "outbound_lead_qualification";
}

export function resolveQualificationDefinition(
  config: ReturnType<typeof parseVoiceAgentConfig>,
): QualificationDefinition {
  const fromAgent = config.advanced?.outboundQualification;
  if (
    fromAgent &&
    typeof fromAgent === "object" &&
    Array.isArray((fromAgent as QualificationDefinition).fields)
  ) {
    return fromAgent as QualificationDefinition;
  }

  if (fs.existsSync(DEFAULT_FIXTURE_PATH)) {
    return JSON.parse(fs.readFileSync(DEFAULT_FIXTURE_PATH, "utf8")) as QualificationDefinition;
  }

  throw new Error(
    "No outboundQualification config on agent and demo fixture missing — run setup-outbound-lead-agent.ts",
  );
}

export async function resolveOutboundQualificationAgentId(input: {
  workspaceId: string;
  agentId?: string;
}): Promise<string> {
  if (input.agentId?.trim()) return input.agentId.trim();

  const prisma = getPrisma();
  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId: input.workspaceId },
    select: { id: true, draftConfig: true, name: true },
  });
  const found = agents.find((agent: (typeof agents)[number]) =>
    isOutboundLeadQualificationAgent(parseVoiceAgentConfig(agent.draftConfig)),
  );
  if (!found) {
    throw new Error(
      "No outbound_lead_qualification agent found — run scripts/setup-outbound-lead-agent.ts first",
    );
  }
  return found.id;
}

export async function triggerOutboundQualificationCall(input: {
  workspaceId: string;
  destinationPhone: string;
  agentId?: string;
  leadName?: string;
  leadSource?: string;
  contactId?: string;
  isTest?: boolean;
  triggerSource: string;
  triggerReason?: string;
  /** CLI keeps env gate; API/cron/boot pass false. */
  requireTestModeEnv?: boolean;
}) {
  const agentId = await resolveOutboundQualificationAgentId({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId: input.workspaceId },
    select: { id: true, draftConfig: true, status: true },
  });
  if (!agent) throw new Error("Agent not found");

  const testableStatuses = ["ACTIVE", "TESTING", "DRAFT"];
  if (input.isTest !== false && !testableStatuses.includes(agent.status)) {
    throw new Error("Agent is not available for testing");
  }

  const config = parseVoiceAgentConfig(agent.draftConfig);
  if (!isOutboundLeadQualificationAgent(config)) {
    throw new Error("Agent is not configured for outbound lead qualification");
  }

  const qualification = resolveQualificationDefinition(config);
  const destinationPhone = input.destinationPhone.trim();
  const leadName = input.leadName?.trim() || "Anthony";

  return startOutboundLeadQualificationCall({
    workspaceId: input.workspaceId,
    agentId,
    destinationPhone,
    isTest: input.isTest !== false,
    requireTestModeEnv: input.requireTestModeEnv,
    qualification,
    lead: {
      leadId: `lead-${Date.now()}`,
      contactId: input.contactId,
      leadPhone: destinationPhone,
      leadName,
      leadSource: input.leadSource || "api_test",
      reasonForContact: qualification.reasonForContact,
    },
    trigger: {
      source: input.triggerSource,
      reason: input.triggerReason || "Outbound qualification test dial",
      consentRecorded: true,
    },
  });
}
