import { readFileSync } from "node:fs";
import { getPrisma } from "@/lib/db";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx scripts/ar-prod-run-sql-file.ts <file.sql>");
  process.exit(1);
}
async function main() {
  const sql = readFileSync(path, "utf8");
  const prisma = getPrisma();
  const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }
  console.log(JSON.stringify({ ok: true, statements: statements.length }));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
