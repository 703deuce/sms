/**
 * One-time: provision dedicated MCTB ingress for ws_1 when runtime still points at platform sender.
 *
 * Run (production DB only, with care):
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/migrate-ws1-dedicated-mctb-ingress.ts
 */
import { assessWorkspaceDedicatedMctbIngress } from "../src/lib/mctb/provisioning/workspace-ingress-validity";
import { provisionMctbWorkspaceTollFreeIngress } from "../src/lib/mctb/provisioning/provision-workspace-toll-free-ingress";
import { resolveCanonicalMctbPlatformSender } from "../src/lib/mctb/messaging/platform-sender-config";

const WORKSPACE_ID = process.env.MCTB_WS1_MIGRATION_WORKSPACE_ID?.trim() || "ws_1";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const before = await assessWorkspaceDedicatedMctbIngress(WORKSPACE_ID);
  const platform = await resolveCanonicalMctbPlatformSender();

  console.log(
    JSON.stringify(
      {
        workspaceId: WORKSPACE_ID,
        before,
        platformSender: platform
          ? { phoneNumberId: platform.phoneNumberId, e164: platform.e164 }
          : null,
      },
      null,
      2,
    ),
  );

  if (before.valid) {
    console.log("No migration needed — dedicated ingress already valid.");
    return;
  }

  const result = await provisionMctbWorkspaceTollFreeIngress(WORKSPACE_ID);
  const after = await assessWorkspaceDedicatedMctbIngress(WORKSPACE_ID);

  console.log(
    JSON.stringify(
      {
        provision: result,
        after,
        ownerAction: after.valid && after.e164
          ? `FORWARD 571-477-6175 TO: ${after.e164}`
          : null,
      },
      null,
      2,
    ),
  );

  if (!result.ok || !after.valid) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
