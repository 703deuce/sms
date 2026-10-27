#!/usr/bin/env node
/**
 * Runtime Prisma migrate deploy with retries (Coolify start / P1001 recovery).
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const newAppRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(newAppRoot, "..");
const deployScript = [
  path.join(repoRoot, "scripts", "deploy-db-migrations.sh"),
  path.join(newAppRoot, "scripts", "deploy-db-migrations.sh"),
].find((p) => existsSync(p));

const maxAttempts = Number(process.env.DB_MIGRATE_MAX_ATTEMPTS || "12");
const baseDelayMs = Number(process.env.DB_MIGRATE_RETRY_MS || "5000");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runOnce() {
  if (!deployScript) {
    console.error("[db-migrate] deploy-db-migrations.sh not found");
    return { code: 1, out: "" };
  }
  const cwd = existsSync(path.join(repoRoot, "new-app")) ? repoRoot : newAppRoot;
  const result = spawnSync("bash", [deployScript], {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const out = `${result.stdout || ""}${result.stderr || ""}`;
  if (out.trim()) process.stdout.write(out);
  return { code: result.status ?? 1, out };
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.warn("[db-migrate] DATABASE_URL unset — skipping migrate deploy at start");
    return 0;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `[db-migrate] attempt ${attempt}/${maxAttempts} ${new Date().toISOString()}`,
    );
    const { code, out } = runOnce();
    if (code === 0) {
      console.log("[db-migrate] schema up to date");
      return 0;
    }
    const retriable =
      /P1001|Can't reach database|ECONNREFUSED|ETIMEDOUT|connection timed out/i.test(out);
    if (!retriable || attempt === maxAttempts) {
      console.error(`[db-migrate] failed after ${attempt} attempt(s), exit=${code}`);
      return code;
    }
    const delay = Math.min(baseDelayMs * attempt, 60_000);
    console.warn(`[db-migrate] retriable error — waiting ${delay}ms before retry`);
    await sleep(delay);
  }
  return 1;
}

main().then((code) => {
  if (code !== 0) process.exit(code);
});
