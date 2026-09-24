#!/usr/bin/env tsx
/**
 * Transovo multi-tenant isolation — permanent regression scaffold.
 *
 * Phase 1 (always): static guards — session APIs, call-handling scoping, contact uniqueness.
 * Phase 2 (optional DB): set TENANT_ISO_WS_A + TENANT_ISO_WS_B + DATABASE_URL.
 *
 * Run: npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

// --- 1. Tenant root: workspace override requires membership ---
{
  const src = read("src/lib/api-auth.ts");
  assert.match(src, /resolveWorkspaceId/, "resolveWorkspaceId must exist");
  assert.match(src, /membership\.findFirst/, "workspace override must check membership");
  console.log("PASS tenant root: resolveWorkspaceId membership gate");
}

// --- 2. Call handling: workspace-scoped ingress phone ---
{
  const src = read("src/lib/call-handling/resolve-canonical-voice-ingress.ts");
  assert.match(src, /workspaceId: input\.workspaceId/g, "ingress phone must be workspace-owned");
  const api = read("src/app/api/call-handling/route.ts");
  assert.match(api, /auth\.workspaceId/, "call-handling API uses session workspace");
  console.log("PASS call handling: canonical ingress scoped to workspace");
}

// --- 3. Contact tenant uniqueness (schema contract) ---
{
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /@@unique\(\[workspaceId, phone\]\)/, "Contact must be unique per workspace+phone");
  console.log("PASS contact: workspaceId+phone unique constraint in schema");
}

// --- 4. MCTB platform inbound uses resolved customer workspace ---
{
  const src = read("src/lib/mctb/messaging/platform-sender-inbound-core.ts");
  assert.match(src, /acceptMctbInboundSmsIngress\(\{[\s\S]*workspaceId: resolution\.workspaceId/);
  console.log("PASS MCTB platform inbound: ingress uses resolver workspaceId");
}

// --- 5. Voice call detail API scopes by session workspace ---
{
  const src = read("src/app/api/voice/calls/[id]/route.ts");
  assert.match(src, /workspaceId: auth\.workspaceId/);
  console.log("PASS voice call GET: workspaceId in query");
}

// --- 6. Voice Telnyx tools: agent must belong to workspace header ---
{
  const src = read("src/app/api/telnyx/voice/tools/route.ts");
  assert.match(src, /where: \{ id: agentId, workspaceId \}/);
  console.log("PASS voice tools: agent lookup includes workspaceId");
}

// --- 7. Appointments isolation script exists ---
{
  const src = read("scripts/test-appointments-tenant-isolation.ts");
  assert.ok(src.includes("requireAppointmentsAccess"));
  console.log("PASS appointments tenant isolation script present");
}

// --- 8. Flag production-risk ws_1 defaults in src (not scripts) ---
{
  const risky: string[] = [];
  const srcPaths = [
    "src/lib/voice/outbound/ensure-realtime-clone-agent.ts",
    "src/app/api/voice/telnyx-official-baseline/route.ts",
  ];
  for (const p of srcPaths) {
    const s = read(p);
    if (s.includes('"ws_1"') || s.includes("'ws_1'")) risky.push(p);
  }
  if (risky.length) {
    console.warn("WARN ws_1 hardcoded fallback in src:", risky.join(", "));
  } else {
    console.log("PASS no ws_1 string literal in sampled risky src paths");
  }
}

// --- Phase 2: optional live DB two-workspace fixture ---
async function phase2DbFixture() {
  const wsA = process.env.TENANT_ISO_WS_A?.trim();
  const wsB = process.env.TENANT_ISO_WS_B?.trim();
  if (!wsA || !wsB || wsA === wsB) {
    console.log("SKIP phase2 DB fixture (set TENANT_ISO_WS_A and TENANT_ISO_WS_B)");
    return;
  }

  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();

  const [a, b] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: wsA }, select: { id: true, name: true } }),
    prisma.workspace.findUnique({ where: { id: wsB }, select: { id: true, name: true } }),
  ]);
  assert.ok(a, `workspace A ${wsA} not found`);
  assert.ok(b, `workspace B ${wsB} not found`);

  const aConv = await prisma.conversation.findFirst({
    where: { workspaceId: wsA },
    select: { id: true },
  });
  if (aConv) {
    const leak = await prisma.conversation.findFirst({
      where: { id: aConv.id, workspaceId: wsB },
    });
    assert.equal(leak, null, "conversation id must not exist in both workspaces");
  }

  const aPhone = await prisma.phoneNumber.findFirst({
    where: { workspaceId: wsA },
    select: { id: true },
  });
  if (aPhone) {
    const cross = await prisma.phoneNumber.findFirst({
      where: { id: aPhone.id, workspaceId: wsB },
    });
    assert.equal(cross, null, "phone number id must not be in workspace B");
  }

  console.log(`PASS phase2 DB isolation spot-check A=${wsA} B=${wsB}`);
}

async function main() {
  await phase2DbFixture();
  console.log("\ntest-transovo-multi-tenant-isolation-fixture: static phase complete");
  console.log("See docs/TRANSOVO-MULTI-TENANT-ISOLATION-AUDIT.md for full matrix and IDOR plan.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
