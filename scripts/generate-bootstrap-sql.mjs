/**
 * Turn supabase/schema.sql into an idempotent bootstrap.sql
 * (safe to re-run after a partial apply).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "supabase/schema.sql"), "utf8");

function wrapType(stmt) {
  const body = stmt.trim().replace(/;$/, "");
  return `DO $$ BEGIN\n    ${body};\nEXCEPTION\n    WHEN duplicate_object THEN NULL;\nEND $$;`;
}

function wrapAlter(stmt) {
  const body = stmt.trim().replace(/;$/, "");
  return `DO $$ BEGIN\n    ${body};\nEXCEPTION\n    WHEN duplicate_object THEN NULL;\nEND $$;`;
}

let out = src.replace(/CREATE TYPE[\s\S]*?;/g, (m) => wrapType(m));
out = out.replaceAll("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ");
out = out.replaceAll("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS ");
out = out.replaceAll("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ");
out = out.replace(/ALTER TABLE[\s\S]*?;/g, (m) => wrapAlter(m));

const header = `-- Idempotent bootstrap for Supabase SQL editor.
-- Safe to re-run if some tables/enums already exist (e.g. partial prior apply).
-- Regenerate: npm run db:schema && npm run db:bootstrap

`;

writeFileSync(join(root, "supabase/bootstrap.sql"), header + out);
console.log("Wrote supabase/bootstrap.sql");

const dropTables = [
  "UsageRecord",
  "AuditLog",
  "Webhook",
  "ApiKey",
  "ComplianceCampaign",
  "ComplianceBrand",
  "ConsentRecord",
  "OptInForm",
  "Keyword",
  "AutomationFlow",
  "Template",
  "ConversationMessage",
  "Conversation",
  "integration_webhook_events",
  "integration_webhook_endpoints",
  "job_queue",
  "review_request_suppression",
  "campaign_messages",
  "campaign_recipients",
  "messaging_registration_events",
  "messaging_registrations",
  "Message",
  "Campaign",
  "ContactTag",
  "Tag",
  "Segment",
  "ContactListMember",
  "ContactList",
  "Contact",
  "PhoneNumber",
  "Membership",
  "Workspace",
  "User",
];

const freshHeader = `-- Transovo fresh install for Supabase SQL editor
--
-- Use this if bootstrap.sql failed with missing columns (e.g. workspaceId)
-- or "relation already exists" from a partial apply.
-- DROPS Transovo app tables, then recreates them. Safe for empty/partial setups.

-- ========== 1) Drop app tables ==========
${dropTables.map((t) => `DROP TABLE IF EXISTS "${t}" CASCADE;`).join("\n")}

-- ========== 2) Create enums + tables + indexes + FKs ==========

`;

writeFileSync(join(root, "supabase/fresh-install.sql"), freshHeader + header + out);
console.log("Wrote supabase/fresh-install.sql");
