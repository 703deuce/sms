#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const AMY = (process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501").trim();
const WS = (process.env.WORKSPACE_ID || "ws_1").trim();

function asRecord(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function extractStore(raw) {
  const config = asRecord(raw);
  const advanced = asRecord(config.advanced);
  const data = asRecord(advanced.voiceWorkflow);
  const activeByAgent = asRecord(data.activeByAgent);
  const definitions = asRecord(data.definitions);
  const active = asRecord(activeByAgent[AMY]);
  return {
    activeWorkflowId: active.workflowId || null,
    activeVersion: active.version || null,
    hasDispatcher: Boolean(asRecord(definitions.home_service_dispatcher)?.["1"]),
  };
}

const prisma = new PrismaClient();
const agent = await prisma.voiceAgent.findFirst({
  where: { id: AMY, workspaceId: WS },
  select: {
    name: true,
    status: true,
    publishedVersionId: true,
    draftConfig: true,
    phoneNumberId: true,
  },
});
const pn = agent?.phoneNumberId
  ? await prisma.phoneNumber.findUnique({ where: { id: agent.phoneNumberId }, select: { e164: true } })
  : null;
const version = agent?.publishedVersionId
  ? await prisma.voiceAgentVersion.findFirst({
      where: { id: agent.publishedVersionId },
      select: { version: true, config: true },
    })
  : null;

console.log(
  JSON.stringify(
    {
      agent: agent?.name,
      status: agent?.status,
      phone: pn?.e164,
      publishedVersion: version?.version,
      draft: extractStore(agent?.draftConfig),
      published: extractStore(version?.config),
    },
    null,
    2,
  ),
);
await prisma.$disconnect();
