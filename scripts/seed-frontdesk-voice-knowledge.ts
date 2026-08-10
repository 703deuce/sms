/**
 * Seed Harbor Home frontdesk agent with structured business info + RAG knowledge.
 *
 * Run: npx tsx scripts/seed-frontdesk-voice-knowledge.ts
 * Optional: AGENT_ID=... WORKSPACE_ID=ws_1 PHONE_E164=+18663464256
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { getPrisma } from "../src/lib/db";
import { createId } from "../src/lib/supabase/id";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { processKnowledgeSource } from "../src/lib/voice/knowledge-processor";
import { resolveBusinessAnswer } from "../src/lib/voice/knowledge/resolve-business-answer";

dotenv.config();

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_E164 = (process.env.PHONE_E164 || "+18663464256").trim();
const RAG_FIXTURE = path.join(process.cwd(), "scripts/fixtures/harbor-home-rag-knowledge.txt");

const STRUCTURED_KNOWLEDGE = {
  businessHours: "Monday through Friday 8 AM to 6 PM, Saturday 9 AM to 2 PM. Closed Sunday.",
  services:
    "Harbor Home Services handles residential plumbing — leaks, drains, water heaters, toilets, and bathroom fixtures. We also do light HVAC coordination for referrals.",
  pricing: {
    serviceCallFee: "$89",
    serviceCallScript:
      "Our standard diagnostic visit is eighty-nine dollars, which is applied toward the repair if you move forward with the work.",
    packages: {
      "Standard diagnostic visit": "$89 applied toward repair",
      "Emergency dispatch": "$149 plus repair estimate",
      "Home Care Plus membership": "$19 per month with priority scheduling and ten percent off repairs",
    },
  },
  faq: {
    parking: "Please leave driveway access clear — our vans need room for the equipment bay doors.",
    pets: "We love pets; please secure dogs in another room when the technician arrives.",
  },
};

async function resolveFrontDeskAgentId(): Promise<string> {
  if (process.env.AGENT_ID?.trim()) return process.env.AGENT_ID.trim();

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: PHONE_E164, workspaceId: WORKSPACE_ID },
    select: { workspaceId: true },
  });
  if (!phone) {
    throw new Error(`Phone ${PHONE_E164} not found in workspace ${WORKSPACE_ID}`);
  }

  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId: WORKSPACE_ID },
    select: { id: true, draftConfig: true },
  });
  const frontdesk = agents.find((row) => {
    const cfg = parseVoiceAgentConfig(row.draftConfig);
    return cfg.advanced?.livekitProfile === "frontdesk";
  });
  if (!frontdesk) {
    throw new Error("No frontdesk agent found — run setup:frontdesk-booking-agent first");
  }
  return frontdesk.id;
}

async function main() {
  const prisma = getPrisma();
  const agentId = await resolveFrontDeskAgentId();
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
      business_name: "Harbor Home Services",
      business_hours: STRUCTURED_KNOWLEDGE.businessHours,
      services_description: STRUCTURED_KNOWLEDGE.services,
    },
    knowledgeBase: STRUCTURED_KNOWLEDGE,
    knowledgeBaseIds: Array.isArray(existingCfg.knowledgeBaseIds)
      ? [...existingCfg.knowledgeBaseIds]
      : [],
  };

  let kbId = draftConfig.knowledgeBaseIds[0];
  if (!kbId) {
    const existingKb = await prisma.voiceKnowledgeBase.findFirst({
      where: { workspaceId: WORKSPACE_ID, name: "Harbor Home Voice Knowledge" },
      select: { id: true },
    });
    kbId = existingKb?.id || createId();
    if (!existingKb) {
      await prisma.voiceKnowledgeBase.create({
        data: {
          id: kbId,
          workspaceId: WORKSPACE_ID,
          name: "Harbor Home Voice Knowledge",
          description: "Structured wizard facts + RAG corpus for phone agent tests",
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

  const sourceName = "Harbor Home RAG test corpus";
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
    resolveBusinessAnswer({ workspaceId: WORKSPACE_ID, agentId, topic: "pricing packages" }),
    resolveBusinessAnswer({ workspaceId: WORKSPACE_ID, agentId, topic: "warranty policy" }),
    resolveBusinessAnswer({ workspaceId: WORKSPACE_ID, agentId, topic: "emergency plumbing" }),
    resolveBusinessAnswer({ workspaceId: WORKSPACE_ID, agentId, topic: "service area Arlington" }),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        workspaceId: WORKSPACE_ID,
        agentId,
        agentName: agent.name,
        knowledgeBaseId: kbId,
        sourceId: source.id,
        fixture: RAG_FIXTURE,
        smokeChecks: checks.map((c, i) => ({
          query: ["hours", "pricing", "warranty", "emergency", "service area"][i],
          ok: c.ok,
          speak: c.speak.slice(0, 120),
          source: c.ok ? c.data.source : c.code,
        })),
        phoneTestHints: {
          knowledge: [
            "What are your hours?",
            "How much is a diagnostic visit?",
            "Do you offer emergency plumbing?",
            "What's your warranty policy?",
            "Do you serve Arlington?",
          ],
          booking: "Book a bathroom leak appointment",
          cancel: "I need to cancel my appointment",
        },
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
