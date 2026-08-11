/**
 * Seed Real Estate Front Desk agent with structured business info + RAG knowledge.
 *
 * Usage:
 *   npx tsx scripts/seed-real-estate-frontdesk-knowledge.ts
 */
import dotenv from "dotenv";
import { seedRealEstateFrontDeskKnowledge } from "@/lib/voice/real-estate/deploy-knowledge";

dotenv.config();

async function main() {
  const result = await seedRealEstateFrontDeskKnowledge({
    workspaceId: process.env.WORKSPACE_ID,
    agentId: process.env.AGENT_ID,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
