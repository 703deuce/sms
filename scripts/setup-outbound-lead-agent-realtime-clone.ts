/**
 * Dev/ops wrapper around ensureOutboundRealtimeCloneAgent.
 * Production uses OUTBOUND_REALTIME_TEST=1 on Coolify — no manual run required.
 */
import dotenv from "dotenv";
import { ensureOutboundRealtimeCloneAgent } from "../src/lib/voice/outbound/ensure-realtime-clone-agent";

dotenv.config();

async function main() {
  const result = await ensureOutboundRealtimeCloneAgent({
    assignPrimaryPhone: process.env.ASSIGN_PHONE === "1",
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
