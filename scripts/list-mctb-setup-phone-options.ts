/**
 * List MCTB setup phone options for a workspace (owned numbers only).
 */
import { getPrisma } from "../src/lib/db";
import { listWorkspaceAccessiblePhoneNumbers } from "../src/lib/numbers/workspace-accessible-numbers";

const workspaceId = process.argv[2] || "ws_1";

async function main() {
  const prisma = getPrisma();
  const phones = await listWorkspaceAccessiblePhoneNumbers(workspaceId);
  console.log(JSON.stringify({ workspaceId, count: phones.length, phones }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
