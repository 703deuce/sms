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
