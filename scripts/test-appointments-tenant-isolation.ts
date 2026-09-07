#!/usr/bin/env tsx
/**
 * Appointments API tenant isolation regression checks.
 * Run: npx tsx scripts/test-appointments-tenant-isolation.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const API_ROOT = join(process.cwd(), "src/app/api/appointments");

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (entry === "route.ts") files.push(full);
  }
  return files;
}

function testAppointmentRoutesRequireSession() {
  const routes = walk(API_ROOT);
  assert.ok(routes.length >= 5, "expected appointment API routes");
  for (const file of routes) {
    const src = readFileSync(file, "utf8");
    assert.match(
      src,
      /requireAppointmentsAccess|requireSession/,
      `${file} must use requireAppointmentsAccess or requireSession for workspace scoping`,
    );
    assert.doesNotMatch(
      src,
      /searchParams\.get\(["']workspaceId["']\)/,
      `${file} must not accept workspaceId from query`,
    );
  }
  console.log(`PASS ${routes.length} appointment routes require session auth`);
}

function testPublicBookDoesNotExposeWorkspaceId() {
  const src = readFileSync(
    join(process.cwd(), "src/app/api/public/book/[slug]/route.ts"),
    "utf8",
  );
  assert.match(src, /resolveWorkspaceBySlug/);
  assert.doesNotMatch(src, /workspaceId.*searchParams/);
  console.log("PASS public book resolves workspace by slug only");
}

function testBookingPlatformScopesByWorkspace() {
  const src = readFileSync(
    join(process.cwd(), "src/lib/appointments/booking-platform.ts"),
    "utf8",
  );
  assert.match(src, /where: \{ id: appointmentId, workspaceId \}/);
  assert.match(src, /where: \{ id: input\.id, workspaceId \}/);
  console.log("PASS booking-platform queries include workspaceId");
}

testAppointmentRoutesRequireSession();
testPublicBookDoesNotExposeWorkspaceId();
testBookingPlatformScopesByWorkspace();
console.log("\nAll tenant isolation checks passed.");
