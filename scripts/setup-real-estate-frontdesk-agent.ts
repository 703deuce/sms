/**
 * Create or upgrade inbound frontdesk agent to Real Estate Front Desk (OpenAI Realtime).
 *
 * Usage:
 *   npx tsx scripts/setup-real-estate-frontdesk-agent.ts
 */
import dotenv from "dotenv";
import { loadRealtorProductConfig } from "@/lib/realtor/workspace-config";
import { DEFAULT_REALTOR_PRODUCT_CONFIG } from "@/lib/realtor/types";
import { ensureRealEstateFrontDeskAgent } from "@/lib/voice/real-estate/deploy-agent";

dotenv.config();

async function main() {
  const workspaceId = process.env.WORKSPACE_ID?.trim() || "ws_1";
  let productConfig = DEFAULT_REALTOR_PRODUCT_CONFIG;
  try {
    productConfig = await loadRealtorProductConfig(workspaceId);
  } catch {
    // use defaults when workspace not available
  }

  const result = await ensureRealEstateFrontDeskAgent({
    workspaceId,
    phoneE164: process.env.PHONE_E164,
    agentName: process.env.RE_FRONTDESK_AGENT_NAME,
    productConfig,
  });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
