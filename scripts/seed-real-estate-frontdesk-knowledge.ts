/**
 * Seed Real Estate Front Desk agent with structured business info + RAG knowledge.
 *
 * Run: npx tsx scripts/seed-real-estate-frontdesk-knowledge.ts
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { getPrisma } from "../src/lib/db";
import { createId } from "../src/lib/supabase/id";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { processKnowledgeSource } from "../src/lib/voice/knowledge-processor";
import { resolveBusinessAnswer } from "../src/lib/voice/knowledge/resolve-business-answer";
import {
  DEFAULT_REAL_ESTATE_BUSINESS,
  isRealEstateFrontDeskAgent,
} from "../src/lib/voice/real-estate/config";

dotenv.config();

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const RAG_FIXTURE = path.join(
  process.cwd(),
  "scripts/fixtures/blue-ridge-realty-rag-knowledge.txt",
);

const business = DEFAULT_REAL_ESTATE_BUSINESS;

const STRUCTURED_KNOWLEDGE = {
  businessHours: "Monday through Friday 9 AM to 6 PM, Saturday 10 AM to 2 PM. Closed Sunday.",
  services:
    "Buyer representation, seller listings, showing coordination, and realtor consultations throughout Northern Virginia.",
  pricing: {
    consultationFee: "Free initial consultation with a licensed realtor",
    consultationScript:
      "Our initial consultation with a realtor is complimentary — they'll learn what you're looking for and outline next steps.",
  },
  faq: {
    mls: "We don't have live MLS listings on this call. A realtor will follow up with matching options.",
    financing: "We are a brokerage, not a lender. We can connect you with trusted lending partners separately.",
    areas: `We serve ${business.serviceAreas.join(", ")} and surrounding Northern Virginia.`,
  },
};

async function resolveAgentId(): Promise<string> {
  if (process.env.AGENT_ID?.trim()) return process.env.AGENT_ID.trim();

  const prisma = getPrisma();
  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId: WORKSPACE_ID },
    select: { id: true, draftConfig: true },
  });
  const reAgent = agents.find((row) => {
    const cfg = parseVoiceAgentConfig(row.draftConfig);
    return isRealEstateFrontDeskAgent(cfg.advanced as Record<string, unknown>);
  });
  if (!reAgent) {
    throw new Error("No RE frontdesk agent found — run setup:real-estate-frontdesk-agent first");
  }
  return reAgent.id;
}

async function main() {
  const prisma = getPrisma();
  const agentId = await resolveAgentId();
  const ragText = fs.readFileSync(RAG_FIXTURE, "utf8");

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId: WORKSPACE_ID },
    select: { draftConfig: true, name: true },
  });
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const existingCfg = parseVoiceAgentConfig(agent.draftConfig);
  const draftConfig = {
    ...existingCfg,
    dynamicVariables: {
      ...(existingCfg.dynamicVariables || {}),
      business_name: business.businessName,
      service_areas: business.serviceAreas,
      property_types: business.propertyTypes,
      knowledge_notes: business.knowledgeNotes,
      authority_boundaries: business.authorityBoundaries,
    },
    knowledgeBase: STRUCTURED_KNOWLEDGE,
    knowledgeBaseIds: Array.isArray(existingCfg.knowledgeBaseIds)
      ? [...existingCfg.knowledgeBaseIds]
      : [],
  };

  let kbId = draftConfig.knowledgeBaseIds[0];
  if (!kbId) {
    const existingKb = await prisma.voiceKnowledgeBase.findFirst({
      where: { workspaceId: WORKSPACE_ID, name: "Blue Ridge Realty Voice Knowledge" },
      select: { id: true },
    });
    kbId = existingKb?.id || createId();
    if (!existingKb) {
      await prisma.voiceKnowledgeBase.create({
        data: {
          id: kbId,
          workspaceId: WORKSPACE_ID,
          name: "Blue Ridge Realty Voice Knowledge",
          description: "Structured wizard facts + RAG corpus for RE front desk",
          status: "active",
        },
      });
    }
    draftConfig.knowledgeBaseIds = [kbId];
  }

  await prisma.voiceAgentKnowledgeBase.upsert({
    where: {
      agentId_knowledgeBaseId: {
        agentId,
        knowledgeBaseId: kbId,
      },
    },
    create: { workspaceId: WORKSPACE_ID, agentId, knowledgeBaseId: kbId },
    update: {},
  });

  const sourceName = "Blue Ridge Realty RE Front Desk RAG";
  let source = await prisma.voiceKnowledgeSource.findFirst({
    where: { workspaceId: WORKSPACE_ID, knowledgeBaseId: kbId, name: sourceName },
  });
  if (!source) {
    source = await prisma.voiceKnowledgeSource.create({
      data: {
        id: createId(),
        workspaceId: WORKSPACE_ID,
        knowledgeBaseId: kbId,
        name: sourceName,
        sourceType: "text",
        contentText: ragText,
        status: "pending",
      },
    });
  } else {
    await prisma.voiceKnowledgeSource.update({
      where: { id: source.id },
      data: { contentText: ragText, status: "pending" },
    });
  }

  await processKnowledgeSource(source.id);

  await prisma.voiceAgent.update({
    where: { id: agentId },
    data: { draftConfig },
  });

  const checks = await Promise.all([
    resolveBusinessAnswer({ workspaceId: WORKSPACE_ID, agentId, topic: "hours" }),
    resolveBusinessAnswer({ workspaceId: WORKSPACE_ID, agentId, topic: "MLS listings" }),
    resolveBusinessAnswer({ workspaceId: WORKSPACE_ID, agentId, topic: "consultation fee" }),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        agentId,
        agentName: agent.name,
        knowledgeBaseId: kbId,
        sourceId: source.id,
        structuredKnowledge: true,
        ragChars: ragText.length,
        phoneE164: PHONE_E164,
        smokeChecks: checks.map((c, i) => ({
          query: ["hours", "MLS", "consultation"][i],
          ok: c.ok,
          speak: c.speak.slice(0, 120),
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
