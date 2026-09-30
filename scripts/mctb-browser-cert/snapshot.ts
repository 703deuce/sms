import { execSync } from "node:child_process";

export type Ws1Snapshot = {
  persisted?: Record<string, unknown>;
  effective?: Record<string, unknown>;
  exclusions?: Record<string, unknown>;
  handoff?: Record<string, unknown>;
};

export function snapshotBackend(workspaceId: string): Ws1Snapshot {
  const out = execSync("npx tsx scripts/mctb-ws1-config-snapshot.ts", {
    cwd: process.cwd(),
    env: { ...process.env, WORKSPACE_ID: workspaceId },
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return JSON.parse(out) as Ws1Snapshot;
}
