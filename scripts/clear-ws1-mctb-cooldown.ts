/**
 * Clear MCTB cooldown for a caller on ws_1 so cert C can be retested immediately.
 *
 * Usage:
 *   CALLER_E164=+1... npx tsx scripts/clear-ws1-mctb-cooldown.ts
 */
import { getPrisma } from "../src/lib/db";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";

const WS = process.env.WORKSPACE_ID || "ws_1";
const CALLER = process.env.CALLER_E164;

async function main() {
  if (!CALLER?.trim()) {
    throw new Error("Set CALLER_E164 to the PSTN number you are testing from");
  }
  const caller = normalizeE164(CALLER);
  const prisma = getPrisma();

  const recent = await prisma.missedCallEvent.findMany({
    where: { workspaceId: WS, callerE164: caller, smsSentAt: { not: null } },
    orderBy: { smsSentAt: "desc" },
    take: 5,
    select: { id: true, smsSentAt: true, status: true },
  });

  if (!recent.length) {
    console.log(JSON.stringify({ ok: true, cleared: 0, note: "no sent events for caller" }, null, 2));
    return;
  }

  const cleared = await prisma.missedCallEvent.updateMany({
    where: {
      workspaceId: WS,
      callerE164: caller,
      smsSentAt: { not: null },
    },
    data: { smsSentAt: null, status: "SUPPRESSED", suppressionReason: "COOLDOWN_CLEARED_FOR_CERT" },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        workspaceId: WS,
        callerE164: caller,
        cleared: cleared.count,
        priorEvents: recent,
        note: "Cooldown window is based on smsSentAt — cleared for cert retest",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
