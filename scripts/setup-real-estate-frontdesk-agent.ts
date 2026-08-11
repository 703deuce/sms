/**
 * Create or upgrade inbound frontdesk agent to Real Estate Front Desk (OpenAI Realtime).
 *
 * Usage:
 *   npx tsx scripts/setup-real-estate-frontdesk-agent.ts
 */
import dotenv from "dotenv";
import { ensureRealEstateFrontDeskAgent } from "@/lib/voice/real-estate/deploy-agent";

dotenv.config();

async function main() {
  const result = await ensureRealEstateFrontDeskAgent({
    phoneE164: process.env.PHONE_E164,
    agentName: process.env.RE_FRONTDESK_AGENT_NAME,
  });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
