#!/usr/bin/env tsx
/**
 * Verify Mode 4 jobs have durable copies in src/kimi-drafts/ (not just .ui-agent/generated).
 *
 *   npm run ui:kimi-mode4-verify-persist
 *   npm run ui:kimi-mode4-verify-persist -- --promote
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { UI_AGENT_DIR } from "./config";
import { assertKimiOutputPersisted, draftDirForSession, persistKimiGeneratedSource } from "./kimi-persist";
import type { Mode4BatchState } from "./kimi-mode4-batch";

const STATE_PATH = join(UI_AGENT_DIR, "mode4", "batch-state.json");

function main(): void {
  const promote = process.argv.includes("--promote");
  if (!existsSync(STATE_PATH)) {
    console.error("No batch state at", STATE_PATH);
    process.exit(1);
  }

  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Mode4BatchState;
  let ok = 0;
  let missing = 0;
  let promoted = 0;

  console.log("\nMode 4 persistence audit\n");

  for (const job of state.jobs) {
    if (job.status !== "complete" || !job.sessionId) continue;

    const sandboxPage = join(UI_AGENT_DIR, "generated", job.sessionId, "page.tsx");
    const draftManifest = join(draftDirForSession(job.sessionId, job.route), "MANIFEST.json");

    if (!existsSync(draftManifest)) {
      if (promote && existsSync(sandboxPage)) {
        try {
          persistKimiGeneratedSource({
            sessionId: job.sessionId,
            targetRoute: job.route,
          });
          console.log(`✓ promoted ${job.canonicalPath} → src/kimi-drafts`);
          promoted += 1;
          ok += 1;
          continue;
        } catch (err) {
          console.log(`✗ ${job.canonicalPath} — promote failed: ${err instanceof Error ? err.message : err}`);
          missing += 1;
          continue;
        }
      }
      console.log(`✗ ${job.canonicalPath} — NO DRAFT (session ${job.sessionId})`);
      missing += 1;
      continue;
    }

    try {
      const manifest = assertKimiOutputPersisted(job.sessionId, job.route);
      console.log(`✓ ${job.canonicalPath} — ${manifest.persistedFiles.length} files in src/kimi-drafts`);
      ok += 1;
    } catch (err) {
      console.log(`✗ ${job.canonicalPath} — corrupt draft: ${err instanceof Error ? err.message : err}`);
      missing += 1;
    }
  }

  console.log(`\nResult: ${ok} persisted, ${missing} missing${promoted ? `, ${promoted} promoted` : ""}\n`);
  if (missing > 0) process.exit(1);
}

main();
