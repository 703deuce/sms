/**
 * Workspace Personal/Business split contracts.
 * Run: npx tsx scripts/test-workspace-split.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const capabilities = read("src/lib/workspace/capabilities.ts");
assert.ok(capabilities.includes("canUseFeature"));
assert.ok(capabilities.includes("PERSONAL"));
assert.ok(capabilities.includes("BUSINESS"));
assert.ok(capabilities.includes("isBusinessOnlyPath"));
assert.ok(capabilities.includes("isPersonalOnlyPath"));

const personalNav = read("src/lib/workspace/personal-nav.ts");
assert.ok(personalNav.includes("/personal/numbers/find"));
assert.ok(personalNav.includes("/personal/numbers/premium"));
assert.ok(personalNav.includes("/personal/vault"));

const schema = read("prisma/schema.prisma");
assert.ok(schema.includes("enum WorkspaceType"));
assert.ok(schema.includes("type                 WorkspaceType"));
assert.ok(schema.includes("ownerUserId"));

const switcher = read("src/components/workspace/workspace-switcher.tsx");
assert.ok(switcher.includes("Add Personal Workspace"));
assert.ok(switcher.includes("Add Business"));

const middleware = read("src/middleware.ts");
assert.ok(middleware.includes("transovo_workspace_type"));
assert.ok(middleware.includes("isBusinessOnlyPath"));
assert.ok(middleware.includes("isPersonalOnlyPath"));

const moveApi = read("src/app/api/numbers/[numberId]/move-workspace/route.ts");
assert.ok(moveApi.includes("workspaceId: body.targetWorkspaceId"));

// Personal routes exist
const personalRoutes = [
  "src/app/(app)/personal/page.tsx",
  "src/app/(app)/personal/numbers/page.tsx",
  "src/app/(app)/personal/numbers/find/page.tsx",
  "src/app/(app)/personal/numbers/premium/page.tsx",
  "src/app/(app)/personal/vault/page.tsx",
  "src/app/(app)/personal/forwarding/page.tsx",
  "src/app/(app)/personal/voicemail/page.tsx",
  "src/app/(app)/personal/porting/page.tsx",
];
for (const route of personalRoutes) {
  assert.ok(fs.existsSync(path.join(process.cwd(), route)), `missing ${route}`);
}

console.log("test-workspace-split: ok");
