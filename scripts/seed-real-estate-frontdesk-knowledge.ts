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
import { isRealEstateFrontDeskAgent } from "../src/lib/voice/real-estate/config";
import { DEFAULT_REAL_ESTATE_BUSINESS } from "../src/lib/voice/real-estate/config";

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

  const config = parseVoiceAgentConfig(agent.draftConfig);
  const nextConfig = {
    ...config,
    knowledge: {
      ...(config.knowledge || {}),
      structured: STRUCTURED_KNOWLEDGE,
    },
    dynamicVariables: {
      ...(config.dynamicVariables || {}),
      business_name: business.businessName,
      service_areas: business.serviceAreas,
      property_types: business.propertyTypes,
      knowledge_notes: business.knowledgeNotes,
      authority_boundaries: business.authorityBoundaries,
    },
  };

  await prisma.voiceAgent.update({
    where: { id: agentId },
    data: { draftConfig: nextConfig as object },
  });

  const sourceId = createId();
  await processKnowledgeSource({
    workspaceId: WORKSPACE_ID,
    agentId,
    sourceId,
    title: "Blue Ridge Realty — RE Front Desk",
    rawText: ragText,
    sourceType: "text",
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        agentId,
        agentName: agent.name,
        sourceId,
        structuredKnowledge: true,
        ragChars: ragText.length,
        phoneE164: PHONE_E164,
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
