/**
 * List accessible MCTB setup numbers for a workspace (dropdown source).
 */
import { loadWorkspaceAccessiblePhoneNumbers } from "../src/lib/numbers/workspace-accessible-numbers";
import { loadMctbSetupPhoneOptions } from "../src/lib/numbers/workspace-accessible-numbers";
import { getPlatformDemoPhoneRecord } from "../src/lib/mctb/platform-demo-access";

const WS = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  const [accessible, demo] = await Promise.all([
    loadWorkspaceAccessiblePhoneNumbers(WS),
    getPlatformDemoPhoneRecord(),
  ]);
  console.log(
    JSON.stringify(
      {
        workspaceId: WS,
        platformDemo: demo,
        accessible: accessible.map((n) => ({
          id: n.id,
          e164: n.e164,
          source: n.source,
          status: n.status,
          friendlyName: n.friendlyName,
        })),
        duplicateE164: Object.entries(
          accessible.reduce<Record<string, string[]>>((acc, n) => {
            const k = n.e164;
            acc[k] = acc[k] || [];
            acc[k].push(`${n.source}:${n.id}`);
            return acc;
          }, {}),
        ).filter(([, ids]) => ids.length > 1),
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
