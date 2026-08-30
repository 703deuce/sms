/**
 * Restore default MCTB cooldown for ws_1 after cert testing.
 *
 *   npx tsx scripts/enable-ws1-mctb-cooldown.ts
 */
import { getPrisma } from "../src/lib/db";
import { updateMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { DEFAULT_MCTB_CONFIG } from "../src/lib/agents/missed-call-text-back/types";

const WS = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  const before = await getPrisma().missedCallTextConfig.findUnique({ where: { workspaceId: WS } });

  const { config: updated } = await updateMissedCallTextConfig({
    workspaceId: WS,
    patch: {
      cooldown_minutes: DEFAULT_MCTB_CONFIG.cooldownMinutes,
      max_messages_per_caller: DEFAULT_MCTB_CONFIG.maxMessagesPerCaller,
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
