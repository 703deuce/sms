/**
 * Rollback FQDN direct MCTB test — restore toll-free + LiveKit FQDN webhook.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  assignE164ToFqdnConnection,
  restoreFqdnWebhook,
} from "@/lib/mctb/sip-diagnostic/fqdn-direct-setup";

const BACKUP_PATH = join(process.cwd(), ".mctb-fqdn-direct-mctb-backup.json");
const apply = process.argv.includes("--apply");

type Backup = {
  testE164: string;
  previousConnectionId: string;
  livekitFqdnConnectionId: string;
  previousLivekitFqdnWebhookUrl: string | null;
  savedAt: string;
};

async function main() {
  console.log("\n══ MCTB FQDN direct rollback ══\n");

  if (!existsSync(BACKUP_PATH)) {
    console.error(`Backup not found: ${BACKUP_PATH}`);
    process.exit(1);
  }

  const backup = JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as Backup;
  console.log("Backup from:", backup.savedAt);
  console.log(`Test E164:                    ${backup.testE164}`);
  console.log(`Previous number connection:   ${backup.previousConnectionId}`);
  console.log(`Previous LiveKit FQDN webhook: ${backup.previousLivekitFqdnWebhookUrl || "(none)"}`);

  if (!apply) {
    console.log("\nDry run — re-run with --apply to rollback.");
    return;
  }

  if (backup.previousLivekitFqdnWebhookUrl) {
    await restoreFqdnWebhook({
      connectionId: backup.livekitFqdnConnectionId,
      webhookUrl: backup.previousLivekitFqdnWebhookUrl,
    });
    console.log("✓ LiveKit FQDN webhook restored");
  }

  if (backup.previousConnectionId) {
    await assignE164ToFqdnConnection(backup.testE164, backup.previousConnectionId);
    console.log(`✓ ${backup.testE164} restored to ${backup.previousConnectionId}`);
  }

  console.log("\n✓ Rollback complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
