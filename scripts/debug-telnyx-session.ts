#!/usr/bin/env npx tsx
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = join(process.cwd(), file);
  if (existsSync(p)) config({ path: p });
}

import { telnyxRequest } from "@/lib/messaging/telnyx/client";

const SESSION = process.argv[2] || "2a3fedf0-a308-11f1-b360-debaecefaa94";
const LEG = process.argv[3] || "2a3ff7dc-a308-11f1-be87-debaecefaa94";

async function main() {
  console.log("Session:", SESSION, "Leg:", LEG);

  for (const path of [
    `/call_events?filter[leg_id]=${LEG}&page[size]=25`,
    `/call_events?filter[call_session_id]=${SESSION}&page[size]=25`,
    `/detail_records?filter[telnyx_session_id]=${SESSION}`,
  ]) {
    try {
      const res = await telnyxRequest(path.replace(/^\//, "").split("?")[0], {
        query: Object.fromEntries(new URLSearchParams(path.split("?")[1] || "")),
      });
      console.log("\n===", path, "===");
      console.log(JSON.stringify(res, null, 2).slice(0, 4000));
    } catch (e) {
      console.log("\n===", path, "ERROR ===", e instanceof Error ? e.message : e);
    }
  }
  for (const webhookId of [
    "6375cda2-f6c3-4ba7-bf18-091315975c9a",
    "108c00fe-6905-47aa-b001-588330d70cdd",
  ]) {
    try {
      const res = await telnyxRequest(`/webhook_deliveries/${webhookId}`);
      console.log("\n=== webhook", webhookId, "===");
      console.log(JSON.stringify(res, null, 2));
    } catch (e) {
      console.log("\n=== webhook", webhookId, "ERROR ===", e instanceof Error ? e.message : e);
    }
  }
}

main().catch(console.error);
