import { execSync } from "node:child_process";
import { buildWs1ConfigSnapshot } from "../mctb-ws1-config-snapshot";

export type Ws1Snapshot = {
  persisted?: Record<string, unknown>;
  effective?: Record<string, unknown>;
  exclusions?: Record<string, unknown>;
  handoff?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
  onboarding?: Record<string, unknown>;
  voicemail?: Record<string, unknown>;
  leadRecovery?: Record<string, unknown>;
};

let cached: { workspaceId: string; snap: Ws1Snapshot } | null = null;

/** Fast in-process read (preferred during browser cert polling). */
export async function refreshSnapshotBackend(workspaceId: string): Promise<Ws1Snapshot> {
  const snap = (await buildWs1ConfigSnapshot(workspaceId)) as Ws1Snapshot;
  cached = { workspaceId, snap };
  return snap;
}

/** Sync read — uses cache when warm; otherwise spawns CLI snapshot (slow). */
export function snapshotBackend(workspaceId: string): Ws1Snapshot {
  if (cached?.workspaceId === workspaceId) return cached.snap;
  const out = execSync("npx tsx scripts/mctb-ws1-config-snapshot.ts", {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WORKSPACE_ID: workspaceId,
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--import ./scripts/preload-server-only.mjs",
    },
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const snap = JSON.parse(out) as Ws1Snapshot;
  cached = { workspaceId, snap };
  return snap;
}
