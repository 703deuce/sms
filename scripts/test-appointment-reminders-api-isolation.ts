#!/usr/bin/env tsx
/**
 * Appointment Reminders API routes must use AR auth (not client workspaceId).
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const API_ROOT = join(process.cwd(), "src/app/api/appointment-reminders");

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

const routes = walk(API_ROOT);
assert.ok(routes.length >= 10, "expected AR API routes");

for (const file of routes) {
  const src = readFileSync(file, "utf8");
  assert.match(
    src,
    /requireAppointmentRemindersAccess/,
    `${file} must use requireAppointmentRemindersAccess`,
  );
  assert.doesNotMatch(
    src,
    /searchParams\.get\(["']workspaceId["']\)/,
    `${file} must not accept workspaceId from query`,
  );
}

console.log(`PASS ${routes.length} appointment-reminders API routes (AR auth + no workspaceId query)`);
