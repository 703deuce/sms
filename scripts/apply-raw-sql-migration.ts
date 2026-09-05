/**
 * Execute a SQL migration file statement-by-statement (supports DO blocks, DROP, ALTER INDEX, etc.).
 * Usage: npx tsx scripts/apply-raw-sql-migration.ts <path-to.sql> [--continue]
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let dollarTag: string | null = null;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1] ?? "";

    if (dollarTag) {
      current += ch;
      if (ch === "$" && sql.slice(i, i + dollarTag.length) === dollarTag) {
        current += dollarTag.slice(1);
        i += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && ch === "$" && next === "$") {
      const end = sql.indexOf("$$", i + 2);
      const taggedEnd = sql.indexOf("$", i + 2);
      if (taggedEnd > i + 2 && sql[taggedEnd + 1] !== "$") {
        const tagEnd = sql.indexOf("$", taggedEnd + 1);
        const tag = sql.slice(i, tagEnd + 1);
        dollarTag = tag;
        current += ch;
        continue;
      }
      current += "$$";
      i += 1;
      if (end === i) {
        // closed immediately
      }
      continue;
    }

    if (!inDoubleQuote && ch === "'" && !inSingleQuote) {
      inSingleQuote = true;
      current += ch;
      continue;
    }
    if (inSingleQuote) {
      current += ch;
      if (ch === "'" && next === "'") {
        current += next;
        i += 1;
        continue;
      }
      if (ch === "'") inSingleQuote = false;
      continue;
    }

    if (!inSingleQuote && ch === '"') {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && ch === ";") {
      const trimmed = current.trim();
      if (trimmed && !trimmed.startsWith("--")) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail && !tail.startsWith("--")) statements.push(tail);
  return statements;
}

async function main() {
  const file = process.argv[2];
  const continueOnError = process.argv.includes("--continue");
  if (!file) {
    console.error("Usage: npx tsx scripts/apply-raw-sql-migration.ts <sql-file> [--continue]");
    process.exit(1);
  }

  const sql = readFileSync(resolve(file), "utf8");
  const statements = splitSqlStatements(sql);
  const prisma = new PrismaClient();
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const statement of statements) {
    const preview = statement.split("\n").find((l) => l.trim() && !l.trim().startsWith("--"))?.slice(0, 90)
      ?? statement.slice(0, 90);
    try {
      await prisma.$executeRawUnsafe(statement);
      applied += 1;
      console.log(`OK (${applied}): ${preview}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists|duplicate|does not exist|cannot drop/i.test(msg)) {
        skipped += 1;
        console.log(`SKIP: ${preview}`);
        console.log(`  ${msg.split("\n")[0]}`);
        continue;
      }
      failed += 1;
      console.error(`FAIL: ${preview}`);
      console.error(msg);
      if (!continueOnError) process.exit(1);
    }
  }

  console.log(`\nDone. Applied: ${applied}, skipped: ${skipped}, failed: ${failed}`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
