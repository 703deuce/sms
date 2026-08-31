/**
 * Promote .ui-agent/generated sandboxes into tracked src/kimi-drafts/.
 *
 *   npm run ui:kimi-batch-promote
 *   npm run ui:kimi-batch-promote -- --session 2026-08-30T23-38-24-565Z-8ac203 --route /auto-replies
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { UI_AGENT_DIR, ensureUiAgentDirs } from "./config";
import { draftDirForSession, persistKimiGeneratedSource } from "./kimi-persist";
import type { BatchState } from "./kimi-batch-pages";

const STATE_PATH = join(UI_AGENT_DIR, "batch", "kimi-slicktext-pages.json");

function parseArg(args: string[], flag: string): string | undefined {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return undefined;
}

function loadState(): BatchState | null {
  if (!existsSync(STATE_PATH)) return null;
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as BatchState;
}

function main(): void {
  ensureUiAgentDirs();
  const args = process.argv.slice(2);
  const sessionArg = parseArg(args, "--session");
  const routeArg = parseArg(args, "--route");

  const routeBySession = new Map<string, string>();
  const state = loadState();
  if (state) {
    for (const job of state.jobs) {
      if (job.sessionId && job.route) routeBySession.set(job.sessionId, job.route);
    }
  }

  const targets: Array<{ sessionId: string; route: string }> = [];
  if (sessionArg && routeArg) {
    targets.push({ sessionId: sessionArg, route: routeArg });
  } else if (sessionArg) {
    const route = routeBySession.get(sessionArg);
    if (!route) throw new Error(`No route in batch state for session ${sessionArg}`);
    targets.push({ sessionId: sessionArg, route });
  } else if (state) {
    for (const job of state.jobs) {
      if (!job.sessionId || !job.route) continue;
      targets.push({ sessionId: job.sessionId, route: job.route });
    }
    // Sandboxes on disk that never made it into batch state
    for (const sessionId of [
      "2026-08-30T23-38-26-731Z-03c6fb",
      "2026-08-30T23-38-26-489Z-d10d45",
      "2026-08-30T23-40-37-227Z-01c9d0",
      "2026-08-30T23-46-59-898Z-59452d",
    ]) {
      if (!routeBySession.has(sessionId)) {
        const route =
          sessionId.includes("59452d") ? "/automations" : sessionId.includes("01c9d0") ? "/campaigns" : null;
        if (route) targets.push({ sessionId, route });
      }
    }
  }

  let promoted = 0;
  let skipped = 0;
  let failed = 0;

  for (const { sessionId, route } of targets) {
    const sandboxPage = join(UI_AGENT_DIR, "generated", sessionId, "page.tsx");
    const manifestPath = join(draftDirForSession(sessionId, route), "MANIFEST.json");
    if (!existsSync(sandboxPage)) {
      console.log(`○ skip ${route} (${sessionId}) — sandbox missing page.tsx`);
      skipped += 1;
      continue;
    }
    if (existsSync(manifestPath)) {
      console.log(`✓ skip ${route} (${sessionId}) — draft already persisted`);
      skipped += 1;
      continue;
    }
    try {
      persistKimiGeneratedSource({ sessionId, targetRoute: route });
      console.log(`✓ promoted ${route} → src/kimi-drafts/.../${sessionId}`);
      promoted += 1;
    } catch (err) {
      console.error(`✗ ${route} (${sessionId}):`, err instanceof Error ? err.message : err);
      failed += 1;
    }
  }

  console.log(`\nPromote done: ${promoted} promoted, ${skipped} skipped, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();
