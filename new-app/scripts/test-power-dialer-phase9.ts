/**
 * Phase 9/10: contacts API must not auto-seed demo rows (no mock data in DB).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const contactsTs = readFileSync(join(import.meta.dirname, "../lib/server/contacts.ts"), "utf8");
assert.ok(!contactsTs.includes("ensureShellContactsCatalog"), "contacts.ts must not bootstrap shell catalog");
assert.ok(!contactsTs.includes("contacts-shell-catalog"), "contacts.ts must not import shell catalog");

try {
  readFileSync(join(import.meta.dirname, "../lib/server/contacts-shell-catalog.ts"), "utf8");
  assert.fail("contacts-shell-catalog.ts must be removed");
} catch (e) {
  assert.ok((e as NodeJS.ErrnoException).code === "ENOENT");
}

console.log("no-shell-catalog-bootstrap: PASS");
console.log("power-dialer-phase9: ALL PASS");
