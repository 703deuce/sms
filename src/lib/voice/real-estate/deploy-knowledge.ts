import fs from "node:fs";
import path from "node:path";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { processKnowledgeSource } from "@/lib/voice/knowledge-processor";
import { DEFAULT_REAL_ESTATE_BUSINESS, isRealEstateFrontDeskAgent } from "./config";

const business = DEFAULT_REAL_ESTATE_BUSINESS;

export const REAL_ESTATE_STRUCTURED_KNOWLEDGE = {
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

function ragFixturePath(): string {
  return path.join(process.cwd(), "scripts/fixtures/blue-ridge-realty-rag-knowledge.txt");
}

export type SeedRealEstateFrontDeskKnowledgeInput = {
  workspaceId?: string;
  agentId?: string;
};

export type SeedRealEstateFrontDeskKnowledgeResult = {
  ok: boolean;
  agentId: string;
  knowledgeBaseId: string;
  sourceId: string;
  ragChars: number;
};

async function resolveAgentId(workspaceId: string, agentId?: string): Promise<string> {
  if (agentId?.trim()) return agentId.trim();
  const prisma = getPrisma();
  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId },
    select: { id: true, draftConfig: true },
  });
  const reAgent = agents.find((row: (typeof agents)[number]) => {
    const cfg = parseVoiceAgentConfig(row.draftConfig);
    return isRealEstateFrontDeskAgent(cfg.advanced as Record<string, unknown>);
  });
  if (!reAgent) {
    throw new Error(`No RE frontdesk agent in ${workspaceId} — run ensureRealEstateFrontDeskAgent first`);
  }
  return reAgent.id;
}

/**
 * Idempotently seed structured + RAG knowledge for the RE front desk agent.
 */
export async function seedRealEstateFrontDeskKnowledge(
  input: SeedRealEstateFrontDeskKnowledgeInput = {},
): Promise<SeedRealEstateFrontDeskKnowledgeResult> {
  const prisma = getPrisma();
  const workspaceId = input.workspaceId?.trim() || process.env.WORKSPACE_ID?.trim() || "ws_1";
  const agentId = await resolveAgentId(workspaceId, input.agentId);
  const ragText = fs.readFileSync(ragFixturePath(), "utf8");

  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
    select: { draftConfig: true },
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
    knowledgeBase: REAL_ESTATE_STRUCTURED_KNOWLEDGE,
    knowledgeBaseIds: Array.isArray(existingCfg.knowledgeBaseIds)
      ? [...existingCfg.knowledgeBaseIds]
      : [],
  };

  let kbId = draftConfig.knowledgeBaseIds[0];
  if (!kbId) {
    const existingKb = await prisma.voiceKnowledgeBase.findFirst({
      where: { workspaceId, name: "Blue Ridge Realty Voice Knowledge" },
      select: { id: true },
    });
    kbId = existingKb?.id || createId();
    if (!existingKb) {
      await prisma.voiceKnowledgeBase.create({
        data: {
          id: kbId,
          workspaceId,
          name: "Blue Ridge Realty Voice Knowledge",
          description: "Structured wizard facts + RAG corpus for RE front desk",
          status: "active",
        },
      });
    }
    draftConfig.knowledgeBaseIds = [kbId];
  }

  await prisma.voiceAgentKnowledgeBase.upsert({
    where: { agentId_knowledgeBaseId: { agentId, knowledgeBaseId: kbId } },
    create: { workspaceId, agentId, knowledgeBaseId: kbId },
    update: {},
  });

  const sourceName = "Blue Ridge Realty RE Front Desk RAG";
  let source = await prisma.voiceKnowledgeSource.findFirst({
    where: { workspaceId, knowledgeBaseId: kbId, name: sourceName },
  });
  if (!source) {
    source = await prisma.voiceKnowledgeSource.create({
      data: {
        id: createId(),
        workspaceId,
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
    data: { draftConfig: draftConfig as object },
  });

  return {
    ok: true,
    agentId,
    knowledgeBaseId: kbId,
    sourceId: source.id,
    ragChars: ragText.length,
  };
}
