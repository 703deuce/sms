import assert from "node:assert/strict";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { isFrontDeskProfile } from "@/lib/voice/frontdesk/agent-config";
import {
  isOutboundLeadQualificationProfile,
} from "@/lib/voice/outbound/agent-config";
import { DEFAULT_REALTOR_PRODUCT_CONFIG } from "@/lib/realtor/types";
import { ensureRealtorOutboundAgent, buildRealtorFollowUpDefinition } from "@/lib/realtor/deploy-speed-to-lead";
import { parseAutomationDefinition } from "@/lib/automations/types";
import { isRealEstateFrontDeskAgent } from "@/lib/voice/real-estate/config";
import {
  resolveFrontDeskTemplateAgent,
  resolveOutboundTemplateAgent,
} from "@/lib/voice/real-estate/agent-templates";
import { ensureRealEstateFrontDeskAgent } from "@/lib/voice/real-estate/deploy-agent";
import { seedRealEstateFrontDeskKnowledge } from "@/lib/voice/real-estate/deploy-knowledge";
import { runRealtorVerificationSuite } from "./index";

export type IntegrationVerificationResult = {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  checks: string[];
};

function workspaceId(): string {
  const id = process.env.WORKSPACE_ID?.trim();
  if (!id) {
    throw new Error("verifyRealtorIntegration requires WORKSPACE_ID");
  }
  return id;
}

/** Live DB integration — deploy paths, template resolution, knowledge seed. */
export async function verifyRealtorIntegration(): Promise<IntegrationVerificationResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: true, skipped: true, reason: "DATABASE_URL missing", checks: [] };
  }

  const checks: string[] = [];
  const ws = workspaceId();
  const prisma = getPrisma();

  const workspace = await prisma.workspace.findUnique({
    where: { id: ws },
    select: { id: true },
  });
  if (!workspace) {
    return { ok: true, skipped: true, reason: `workspace ${ws} not found`, checks: [] };
  }

  const frontDeskTemplate = await resolveFrontDeskTemplateAgent(ws);
  assert.ok(frontDeskTemplate, "expected a front desk template agent in workspace");
  checks.push(`front_desk_template:${frontDeskTemplate.agentName}`);

  const outboundTemplate = await resolveOutboundTemplateAgent(ws);
  assert.ok(outboundTemplate, "expected an outbound qualification template agent");
  checks.push(`outbound_template:${outboundTemplate.agentName}`);

  const phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId: ws },
    select: { e164: true },
  });
  if (!phone?.e164) {
    return {
      ok: true,
      skipped: true,
      reason: `workspace ${ws} has no phone number for deploy integration`,
      checks,
    };
  }

  const frontDesk = await ensureRealEstateFrontDeskAgent({
    workspaceId: ws,
    phoneE164: phone.e164,
    assignPhone: true,
    productConfig: DEFAULT_REALTOR_PRODUCT_CONFIG,
    publish: false,
  });
  assert.ok(frontDesk.agentId);
  assert.ok(frontDesk.templateAgentId || frontDesk.templateAgentName);
  checks.push(`deploy_front_desk:${frontDesk.agentId}`);

  const agentRow = await prisma.voiceAgent.findFirst({
    where: { id: frontDesk.agentId, workspaceId: ws },
    select: { name: true, draftConfig: true, status: true },
  });
  assert.ok(agentRow);
  const cfg = parseVoiceAgentConfig(agentRow.draftConfig);
  assert.ok(isRealEstateFrontDeskAgent(cfg.advanced as Record<string, unknown>));
  assert.ok(isFrontDeskProfile(cfg.advanced as Record<string, unknown>));
  assert.ok((cfg.advanced as Record<string, unknown>)?.realEstateCompiled);
  assert.equal(agentRow.status, "ACTIVE");
  checks.push("front_desk_config_valid");

  const knowledge = await seedRealEstateFrontDeskKnowledge({
    workspaceId: ws,
    agentId: frontDesk.agentId,
  });
  assert.ok(knowledge.knowledgeBaseId);
  assert.ok(knowledge.sourceId);
  checks.push(`knowledge_seeded:${knowledge.knowledgeBaseId}`);

  const kbLink = await prisma.voiceAgentKnowledgeBase.findFirst({
    where: { agentId: frontDesk.agentId, knowledgeBaseId: knowledge.knowledgeBaseId },
  });
  assert.ok(kbLink);
  checks.push("knowledge_linked_to_agent");

  const outbound = await ensureRealtorOutboundAgent({
    workspaceId: ws,
    productConfig: DEFAULT_REALTOR_PRODUCT_CONFIG,
  });
  assert.ok(outbound.agentId);
  checks.push(`deploy_outbound:${outbound.agentId}`);

  const outboundRow = await prisma.voiceAgent.findFirst({
    where: { id: outbound.agentId, workspaceId: ws },
    select: { name: true, draftConfig: true, outboundAiEnabled: true },
  });
  assert.ok(outboundRow);
  const outboundCfg = parseVoiceAgentConfig(outboundRow.draftConfig);
  assert.ok(isOutboundLeadQualificationProfile(outboundCfg));
  assert.ok((outboundCfg.advanced as Record<string, unknown>)?.realEstateSpeedToLeadCompiled);
  assert.equal(outboundRow.outboundAiEnabled, true);
  checks.push("outbound_config_valid");

  const followUpDef = buildRealtorFollowUpDefinition(outbound.agentId);
  const parsed = parseAutomationDefinition(followUpDef);
  assert.ok(parsed.nodes.length >= 5);
  assert.ok(parsed.edges.length >= 4);
  checks.push("follow_up_automation_graph_valid");

  const staticSuite = runRealtorVerificationSuite();
  assert.equal(staticSuite.ok, true);
  checks.push("static_suite_pass");

  return { ok: true, skipped: false, checks };
}
