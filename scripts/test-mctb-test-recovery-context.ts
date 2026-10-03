#!/usr/bin/env npx tsx
/**
 * Onboarding / live-test must bypass production cooldown (no SUPPRESSED COOLDOWN_ACTIVE).
 */
import assert from "node:assert/strict";
import Module from "node:module";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

async function main() {
  const { isMctbTestRecoveryContext } = await import(
    "../src/lib/mctb/onboarding/test-recovery-context"
  );
  const { getPrisma } = await import("../src/lib/db");

  const prisma = getPrisma();
  const token = `trc-${Date.now()}`;
  const ws = await prisma.workspace.create({
    data: { name: "Test recovery ctx", slug: `trc-${token}` },
  });

  try {
    assert.equal(await isMctbTestRecoveryContext(ws.id, { liveTest: true }), true);
    assert.equal(await isMctbTestRecoveryContext(ws.id, null), true);
    console.log("PASS isMctbTestRecoveryContext (onboarding + liveTest metadata)");
  } finally {
    await prisma.workspace.delete({ where: { id: ws.id } }).catch(() => undefined);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
