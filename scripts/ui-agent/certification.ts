/**
 * Visual UI Agent certification — run without Kimi API for structural checks.
 * Full certification (with Kimi) requires KIMI_API_KEY.
 *
 *   npx tsx scripts/ui-agent/certification.ts
 *   npx tsx scripts/ui-agent/certification.ts --quick
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { applyAcceptedChanges } from "./apply-plan";
import { validateImplementationPlan } from "./change-plan";
import { REPO_ROOT, ensureUiAgentDirs } from "./config";
import { isAllowedUiPath, isProtectedPath, normalizeRepoRelativePath } from "./path-guards";
import { buildProjectManifest } from "./project-context";

const quick = process.argv.includes("--quick");

function gate(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

gate("protected backend paths rejected", () => {
  assert.ok(isProtectedPath("src/lib/messaging/service.ts"));
  assert.ok(isProtectedPath("src/app/api/mctb/setup/route.ts"));
  assert.ok(isProtectedPath("prisma/schema.prisma"));
  assert.ok(!isAllowedUiPath("src/lib/foo.ts"));
});

gate("presentation paths allowed", () => {
  assert.ok(isAllowedUiPath("src/components/ui/button.tsx"));
  assert.ok(isAllowedUiPath("src/app/(app)/conversations/page.tsx"));
});

gate("path traversal rejected by normalize", () => {
  assert.throws(() => normalizeRepoRelativePath("../../etc/passwd"));
});

gate("implementation plan rejects protected files", () => {
  const { accepted, rejected } = validateImplementationPlan({
    summary: "test",
    notes: [],
    changes: [
      {
        file: "src/lib/secret-backend.ts",
        action: "modify",
        reason: "should reject",
        content: "export const x = 1;",
      },
      {
        file: "src/components/ui-agent-cert/SafePresentationDemo.tsx",
        action: "modify",
        reason: "safe",
        content: `export function SafePresentationDemo() { return <div>cert</div>; }`,
      },
    ],
  });
  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 1);
});

gate("dry-run apply does not require Kimi", () => {
  const touched = applyAcceptedChanges(
    [
      {
        file: "src/components/ui-agent-cert/SafePresentationDemo.tsx",
        action: "modify",
        reason: "dry-run",
        content: `export function SafePresentationDemo() { return <div data-ui-agent-cert="dry-run" />; }`,
      },
    ],
    true,
  );
  assert.equal(touched.length, 1);
});

gate("integration principles constant defined", () => {
  const { INTEGRATION_PRINCIPLES } = require("./config") as typeof import("./config");
  const lower = INTEGRATION_PRINCIPLES.toLowerCase();
  assert.ok(lower.includes("starting frontend implementation"));
  assert.ok(lower.includes("approved kimi"));
});

gate("integration plan rejects mock-data imports", () => {
  const { validateIntegrationPlan } = require("./integrate") as typeof import("./integrate");
  assert.throws(() =>
    validateIntegrationPlan({
      summary: "bad",
      notes: [],
      changes: [
        {
          file: "src/components/ui-agent-cert/SafePresentationDemo.tsx",
          action: "modify",
          reason: "mock",
          content: `import { MOCK } from '../../.ui-agent/generated/x/mock-data'`,
        },
      ],
    }),
  );
});

gate("generated sandbox path isolation", () => {
  const { writeGeneratedFiles, listGeneratedFiles } = require("./generated-sandbox") as typeof import("./generated-sandbox");
  const sid = "cert-test-session";
  writeGeneratedFiles(sid, [{ path: "page.tsx", content: "export default function ReferencePage() { return null }" }]);
  const files = listGeneratedFiles(sid);
  assert.ok(files.includes("page.tsx"));
  assert.throws(() => {
    const { assertGeneratedSandboxPath } = require("./generated-sandbox") as typeof import("./generated-sandbox");
    assertGeneratedSandboxPath(sid, "../../../etc/passwd");
  });
});

if (!quick) {
  gate("project manifest resolves conversations route", () => {
    const manifest = buildProjectManifest("/conversations");
    assert.ok(manifest.targetFiles.some((f) => f.includes("conversations")));
    assert.ok(manifest.inScope.length > 0);
  });

  gate("ui-agent directories exist after ensure", () => {
    ensureUiAgentDirs();
    assert.ok(existsSync(join(REPO_ROOT, ".ui-agent")));
    assert.ok(existsSync(join(REPO_ROOT, "scripts/ui-agent/README.md")));
  });
}

console.log("\nui-agent certification: ok");
