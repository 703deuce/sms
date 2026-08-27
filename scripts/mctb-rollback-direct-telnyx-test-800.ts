/**
 * Rollback MCTB direct Telnyx test — restore 855 assignment + FQDN webhook from backup.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-direct-telnyx-test-800.ts
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-rollback-direct-telnyx-test-800.ts --apply
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { assignE164ToConnection, restoreFqdnWebhook } from "@/lib/mctb/direct-telnyx-test/telnyx-fqdn-route";

const BACKUP_PATH = join(process.cwd(), ".mctb-direct-telnyx-test-800-backup.json");
const apply = process.argv.includes("--apply");

type Backup = {
  testE164: string;
  providerNumberId: string;
  previousConnectionId: string;
  previousConnectionName: string;
  fqdnConnectionId: string;
  previousFqdnWebhookUrl: string | null;
  targetWebhookUrl: string;
  savedAt: string;
};

async function main() {
  console.log("\n══ MCTB Direct Telnyx Test rollback ══\n");

  if (!existsSync(BACKUP_PATH)) {
    console.error(`Backup not found: ${BACKUP_PATH}`);
    console.error("Nothing to rollback.");
    process.exit(1);
  }

  const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as Backup;
  console.log("Backup from:", backup.savedAt);
  console.log(`Test E164:           ${backup.testE164}`);
  console.log(`Previous connection: ${backup.previousConnectionId} (${backup.previousConnectionName || "unknown"})`);
  console.log(`Previous FQDN webhook: ${backup.previousFqdnWebhookUrl || "(none)"}`);

  if (!apply) {
    console.log("\nDry run — no changes made.");
    console.log(`Would restore ${backup.testE164} → ${backup.previousConnectionId}`);
    console.log(`Would restore FQDN webhook → ${backup.previousFqdnWebhookUrl || "(unchanged)"}`);
    console.log("\nRe-run with --apply to rollback.");
    return;
  }

  if (backup.previousFqdnWebhookUrl) {
    await restoreFqdnWebhook({
      connectionId: backup.fqdnConnectionId,
      webhookUrl: backup.previousFqdnWebhookUrl,
    });
    console.log("✓ FQDN webhook restored");
  }

  if (backup.previousConnectionId) {
    await assignE164ToConnection(backup.testE164, backup.previousConnectionId);
    console.log(`✓ ${backup.testE164} restored to ${backup.previousConnectionId}`);
  }

  console.log("\n✓ Rollback complete. Unset MCTB_DIRECT_TELNYX_TEST on transovo-web when finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
