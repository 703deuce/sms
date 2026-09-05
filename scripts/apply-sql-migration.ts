/**
 * Apply a multi-statement SQL migration file via Prisma.
 * Usage: npx tsx scripts/apply-sql-migration.ts <path-to.sql>
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/apply-sql-migration.ts <sql-file>");
    process.exit(1);
  }

  const sql = readFileSync(resolve(file), "utf8");
  const creates = [...sql.matchAll(/CREATE TABLE[\s\S]*?\);/g)].map((m) => m[0].trim());
  const indexes = [...sql.matchAll(/CREATE (?:UNIQUE )?INDEX[\s\S]*?;/g)].map((m) => m[0].trim());
  const alters = [...sql.matchAll(/ALTER TABLE[\s\S]*?;/g)].map((m) => m[0].trim());
  const statements = [...creates, ...indexes, ...alters];

  const prisma = new PrismaClient();
  let applied = 0;
  for (const statement of statements) {
    const preview = statement.split("\n")[0]?.slice(0, 80) || statement.slice(0, 80);
    try {
      await prisma.$executeRawUnsafe(`${statement};`);
      applied += 1;
      console.log(`OK (${applied}): ${preview}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists|duplicate/i.test(msg)) {
        console.log(`SKIP (exists): ${preview}`);
        continue;
      }
      console.error(`FAIL: ${preview}`);
      console.error(msg);
      process.exit(1);
    }
  }
  console.log(`\nApplied ${applied} statements from ${file}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
