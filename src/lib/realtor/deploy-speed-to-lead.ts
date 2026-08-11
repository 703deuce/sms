import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "@/lib/db";
import {
  createEdgeId,
  createNodeId,
  type AutomationDefinition,
} from "@/lib/automations/types";
import { triggerFromBlockType } from "@/lib/automations/catalog";
import { findTriggerNode, parseAutomationDefinition } from "@/lib/automations/types";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { isOutboundRealtimeTestEnabled } from "@/lib/voice/outbound/outbound-boot";
import type { RealtorProductConfig } from "./types";

const FOLLOW_UP_FLOW_NAME = "Amy — New Lead Follow-Up (Recommended)";
const OUTBOUND_STACK_AGENT_NAME = "Outbound Lead Qualification (Demo)";

function loadQualificationFixture(): Record<string, unknown> {
  const fixturePath = path.join(
    process.cwd(),
    "scripts/fixtures/blue-ridge-realty-qualification.json",
  );
  return JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
}

export function buildRealtorFollowUpDefinition(agentId: string): AutomationDefinition {
  const triggerId = createNodeId();
  const callNowId = createNodeId();
  const waitOutcomeId = createNodeId();
  const smsNoAnswerId = createNodeId();
  const wait2hId = createNodeId();
  const retryCallId = createNodeId();
  const waitNextDayId = createNodeId();
  const smsDay2Id = createNodeId();
  const endId = createNodeId();

  return {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: triggerId,
        type: "trigger",
        position: { x: 260, y: 40 },
        data: {
          blockType: "customer_added",
          label: "Customer added",
          config: {},
          origin: "system_required",
          templateNodeKey: "trigger",
        },
      },
      {
        id: callNowId,
        type: "action",
        position: { x: 260, y: 180 },
        data: {
          blockType: "start_ai_call",
          label: "Amy calls immediately",
          config: {
            agentId,
            purpose: "Speed-to-Lead qualification",
            timeoutSeconds: 90,
            retryCount: 0,
            contextJson: "{}",
          },
          origin: "template_managed",
          templateNodeKey: "initial_call",
        },
      },
      {
        id: waitOutcomeId,
        type: "logic",
        position: { x: 260, y: 320 },
        data: {
          blockType: "wait_for_call_result",
          label: "Call outcome",
          config: { timeoutMinutes: 30, branchField: "outcome" },
          origin: "template_managed",
          templateNodeKey: "call_outcome",
        },
      },
      {
        id: smsNoAnswerId,
        type: "action",
        position: { x: 80, y: 460 },
        data: {
          blockType: "send_sms",
          label: "No answer SMS",
          config: {
            body:
              "Hi {{customer.firstName}}, this is Amy with {{business.name}} — I tried calling about your inquiry. Reply here or call us back when you have a moment.",
          },
          origin: "template_managed",
          templateNodeKey: "no_answer_sms",
        },
      },
      {
        id: wait2hId,
        type: "action",
        position: { x: 260, y: 600 },
        data: {
          blockType: "wait",
          label: "Wait 2 hours",
          config: { hours: 2 },
          origin: "template_managed",
          templateNodeKey: "wait_2h",
        },
      },
      {
        id: retryCallId,
        type: "action",
        position: { x: 260, y: 740 },
        data: {
          blockType: "start_ai_call",
          label: "Amy retries call",
          config: {
            agentId,
            purpose: "Speed-to-Lead retry",
            timeoutSeconds: 90,
            retryCount: 0,
            contextJson: "{}",
          },
          origin: "template_managed",
          templateNodeKey: "retry_call",
        },
      },
      {
        id: waitNextDayId,
        type: "action",
        position: { x: 260, y: 880 },
        data: {
          blockType: "wait",
          label: "Wait until next day",
          config: { days: 1, respectBusinessHours: true },
          origin: "template_managed",
          templateNodeKey: "wait_next_day",
        },
      },
      {
        id: smsDay2Id,
        type: "action",
        position: { x: 260, y: 1020 },
        data: {
          blockType: "send_sms",
          label: "Day 2 follow-up SMS",
          config: {
            body:
              "Hi {{customer.firstName}}, checking in from {{business.name}} — still happy to help with your home search or sale. Reply anytime.",
          },
          origin: "template_managed",
          templateNodeKey: "day2_sms",
        },
      },
      {
        id: endId,
        type: "end",
        position: { x: 260, y: 1160 },
        data: {
          blockType: "end",
          label: "Done",
          config: {},
          origin: "system_required",
          templateNodeKey: "end",
        },
      },
    ],
    edges: [
      { id: createEdgeId(), source: triggerId, target: callNowId },
      { id: createEdgeId(), source: callNowId, target: waitOutcomeId },
      { id: createEdgeId(), source: waitOutcomeId, target: smsNoAnswerId, sourceHandle: "no" },
      { id: createEdgeId(), source: waitOutcomeId, target: wait2hId, sourceHandle: "default" },
      { id: createEdgeId(), source: smsNoAnswerId, target: wait2hId },
      { id: createEdgeId(), source: wait2hId, target: retryCallId },
      { id: createEdgeId(), source: retryCallId, target: waitNextDayId },
      { id: createEdgeId(), source: waitNextDayId, target: smsDay2Id },
      { id: createEdgeId(), source: smsDay2Id, target: endId },
    ],
  };
}

async function ensureStackOutboundAgent(workspaceId: string): Promise<string> {
  const prisma = getPrisma();
  const qualification = loadQualificationFixture();
  const phoneE164 =
    process.env.PHONE_E164?.trim() ||
    process.env.FRONTDESK_PHONE_E164?.trim() ||
    "+18663464256";

  const phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: phoneE164 },
    select: { id: true },
  });

  let agent = await prisma.voiceAgent.findFirst({
    where: { workspaceId, name: OUTBOUND_STACK_AGENT_NAME },
    select: { id: true, draftConfig: true },
  });

  const baseConfig = agent ? parseVoiceAgentConfig(agent.draftConfig) : parseVoiceAgentConfig({});
  const draftConfig = {
    ...baseConfig,
    advanced: {
      ...(baseConfig.advanced || {}),
      livekitProfile: "outbound_lead_qualification",
      outboundQualification: qualification,
    },
    dynamicVariables: {
      ...(baseConfig.dynamicVariables || {}),
      business_name: String(qualification.businessName || "Blue Ridge Realty"),
    },
  };

  if (agent) {
    await prisma.voiceAgent.update({
      where: { id: agent.id },
      data: {
        draftConfig: draftConfig as object,
        outboundAiEnabled: true,
        status: "ACTIVE",
        phoneNumberId: phone?.id,
        directions: ["outbound"],
      },
    });
    return agent.id;
  }

  const created = await prisma.voiceAgent.create({
    data: {
      workspaceId,
      name: OUTBOUND_STACK_AGENT_NAME,
      description: "Speed-to-Lead outbound qualification for Transovo Real Estate",
      agentType: "custom",
      status: "ACTIVE",
      outboundAiEnabled: true,
      phoneNumberId: phone?.id,
      directions: ["outbound"],
      draftConfig: draftConfig as object,
    },
    select: { id: true },
  });
  return created.id;
}

export async function ensureRealtorOutboundAgent(input: {
  workspaceId: string;
}): Promise<{ agentId: string; created: boolean }> {
  if (isOutboundRealtimeTestEnabled()) {
    const { ensureOutboundRealtimeCloneAgent } = await import(
      "@/lib/voice/outbound/ensure-realtime-clone-agent"
    );
    const clone = await ensureOutboundRealtimeCloneAgent({ workspaceId: input.workspaceId });
    return { agentId: clone.agentId, created: clone.created };
  }
  const existing = await getPrisma().voiceAgent.findFirst({
    where: { workspaceId: input.workspaceId, name: OUTBOUND_STACK_AGENT_NAME },
    select: { id: true },
  });
  const agentId = await ensureStackOutboundAgent(input.workspaceId);
  return { agentId, created: !existing };
}

export async function ensureRealtorFollowUpAutomation(input: {
  workspaceId: string;
  outboundAgentId: string;
}): Promise<{ flowId: string; created: boolean }> {
  const prisma = getPrisma();
  const definition = buildRealtorFollowUpDefinition(input.outboundAgentId);
  const def = parseAutomationDefinition(definition);
  const triggerNode = findTriggerNode(def);
  const triggerLabel = triggerNode
    ? triggerFromBlockType(triggerNode.data.blockType)
    : "Customer added";

  const existing = await prisma.automationFlow.findFirst({
    where: { workspaceId: input.workspaceId, name: FOLLOW_UP_FLOW_NAME },
    select: { id: true },
  });

  if (existing) {
    await prisma.automationFlow.update({
      where: { id: existing.id },
      data: {
        definition: definition as object,
        trigger: triggerLabel,
        status: "ACTIVE",
      },
    });
    return { flowId: existing.id, created: false };
  }

  const row = await prisma.automationFlow.create({
    data: {
      workspaceId: input.workspaceId,
      name: FOLLOW_UP_FLOW_NAME,
      trigger: triggerLabel,
      definition: definition as object,
      status: "ACTIVE",
    },
  });

  await enqueueJob({
    jobType: "automation_tick",
    queueName: "automations",
    workspaceId: input.workspaceId,
    payload: { flowId: row.id, workspaceId: input.workspaceId },
    idempotencyKey: `automation-tick:${row.id}:${new Date().toISOString().slice(0, 16)}`,
  });

  return { flowId: row.id, created: true };
}

export async function deployRealtorSpeedToLead(input: {
  workspaceId: string;
  config: RealtorProductConfig;
}): Promise<{
  outboundAgentId: string;
  followUpAutomationId?: string;
}> {
  if (input.config.amyMode === "front_desk") {
    return { outboundAgentId: "" };
  }

  const outbound = await ensureRealtorOutboundAgent({ workspaceId: input.workspaceId });
  let followUpAutomationId: string | undefined;

  if (input.config.speedToLead.useRecommendedFollowUp) {
    const flow = await ensureRealtorFollowUpAutomation({
      workspaceId: input.workspaceId,
      outboundAgentId: outbound.agentId,
    });
    followUpAutomationId = flow.flowId;
  }

  return { outboundAgentId: outbound.agentId, followUpAutomationId };
}
