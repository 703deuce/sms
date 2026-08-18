/**
 * DB-level inbound route verification for Personal Telnyx + Twilio numbers.
 */
import dotenv from "dotenv";
dotenv.config();

import { getPrisma } from "../src/lib/db";
import { resolveNumberInboundRoute } from "../src/lib/numbers/inbound-number-routing";

const TELNYX_E164 = (process.env.TELNYX_E164 || "+15714073615").trim();
const TWILIO_E164 = (process.env.TWILIO_E164 || "+18665779653").trim();
const PERSONAL_WS = (process.env.PERSONAL_WORKSPACE_ID || "cmsu9n9zq3y57165y5c2x3m59").trim();

function digits(e: string) {
  return e.replace(/\D/g, "");
}

async function main() {
  const prisma = getPrisma();
  const rows = await prisma.phoneNumber.findMany({
    where: { workspaceId: PERSONAL_WS },
  });

  for (const e164 of [TELNYX_E164, TWILIO_E164]) {
    const row = rows.find((r) => digits(r.e164) === digits(e164));
    if (!row) {
      console.log(`FAIL ${e164}: not in workspace`);
      continue;
    }
    const route = resolveNumberInboundRoute(row);
    const settings = (row.settingsJson as Record<string, unknown>) || {};
    console.log(`\n${row.e164} provider=${row.provider}`);
    console.log(`  parked=${settings.parked} routingOwner=${settings.routingOwner}`);
    console.log(`  forwardingEnabled=${settings.forwardingEnabled} targets=${JSON.stringify(settings.forwardTargets)}`);
    console.log(`  voicemailEnabled=${settings.voicemailEnabled}`);
    console.log(`  inboundRoute.kind=${route.kind}`);
    if (route.kind === "forward") {
      console.log(`  forward.destinations=${JSON.stringify(route.destinations)}`);
    }
    const ok =
      route.kind === "forward" &&
      route.destinations.length > 0 &&
      settings.voicemailEnabled === true;
    console.log(ok ? "PASS routing-forward+vm" : `WARN routing state: ${route.kind}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
