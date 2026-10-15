/**
 * Reviews contacts migration aligns with listBusinessContacts SELECT.
 *
 *   npx tsx scripts/test-reputation-contacts-migration-schema.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const migration = readFileSync(
  join(root, "prisma/migrations/20261015103000_reputation_contacts_engagement_columns/migration.sql"),
  "utf8",
);
const contactsTs = readFileSync(join(root, "src/lib/reputation/contacts.ts"), "utf8");

const selectMatch = contactsTs.match(/\.select\(\s*\n\s*"([^"]+)"/);
assert.ok(selectMatch, "contacts list select string");
const cols = selectMatch![1]!.split(/,\s*/);

for (const col of cols) {
  if (["id", "first_name", "last_name", "customer_name", "phone_e164", "email_normalized", "customer_phone", "customer_email", "tags", "sms_opt_out", "email_unsubscribed", "created_at", "updated_at"].includes(col)) {
    continue;
  }
  if (["source", "last_contacted_at", "campaign_attempts", "latest_reply_at", "review_completion"].includes(col)) {
    assert.ok(
      migration.includes(col),
      `migration must add column ${col} used by listBusinessContacts`,
    );
    if (col === "campaign_attempts") {
      assert.ok(migration.includes("DEFAULT 0"), "campaign_attempts defaults to 0 for existing rows");
    } else {
      assert.ok(!migration.includes(`${col} NOT NULL`), `${col} should stay nullable for existing rows`);
    }
    continue;
  }
  throw new Error(`unexpected select column in test: ${col}`);
}

console.log("test-reputation-contacts-migration-schema: ok");
