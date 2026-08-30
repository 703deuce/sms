/**
 * Turn off MCTB cooldown for ws_1 cert testing (re-enable later via enable script).
 *
 *   npx tsx scripts/disable-ws1-mctb-cooldown.ts
 */
import { getPrisma } from "../src/lib/db";
import { updateMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";

const WS = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  const prisma = getPrisma();
  const before = await prisma.missedCallTextConfig.findUnique({ where: { workspaceId: WS } });

  const { config: updated } = await updateMissedCallTextConfig({
    workspaceId: WS,
    patch: {
      cooldown_minutes: 0,
      max_messages_per_caller: 100,
    },
  });

  const cleared = await prisma.missedCallEvent.updateMany({
    where: { workspaceId: WS, smsSentAt: { not: null } },
    data: {
      smsSentAt: null,
      status: "SUPPRESSED",
      suppressionReason: "COOLDOWN_CLEARED_FOR_CERT",
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        workspaceId: WS,
        before: {
          cooldownMinutes: before?.cooldownMinutes,
          maxMessagesPerCaller: before?.maxMessagesPerCaller,
        },
        after: {
          cooldownMinutes: updated.cooldownMinutes,
          maxMessagesPerCaller: updated.maxMessagesPerCaller,
        },
        clearedSentEvents: cleared.count,
        note: "Cooldown disabled for cert — run enable-ws1-mctb-cooldown.ts when done",
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
