/**
 * Ops: publish canonical workspace receptionist (new-app runtime).
 *
 *   cd new-app && NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/publish-workspace-receptionist.mjs ws_1
 *   Add --apply to mutate (default dry-run prints validation only).
 */
import { PrismaClient } from "@prisma/client";

const workspaceId = process.argv[2] || "ws_1";
const apply = process.argv.includes("--apply");

const { publishReceptionist } = await import("../lib/server/receptionist/agent-service.ts");
const { ensureWorkspaceReceptionistAgent, loadDraftFromAgent } = await import(
  "../lib/server/receptionist/agent-store.ts"
);
const { validateReceptionistPublish } = await import("../lib/server/voice-v3/publish-gate.ts");

const prisma = new PrismaClient();

try {
  const agent = await ensureWorkspaceReceptionistAgent(workspaceId);
  const draft = loadDraftFromAgent(agent);
  const validation = await validateReceptionistPublish(workspaceId, draft.editor);
  console.log(JSON.stringify({ workspaceId, agentId: agent.id, validation }, null, 2));

  if (!apply) {
    console.log("Dry-run. Pass --apply to publish.");
    process.exit(validation.ok ? 0 : 1);
  }

  if (!validation.ok) process.exit(1);

  const result = await publishReceptionist(workspaceId);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
} finally {
  await prisma.$disconnect();
}
