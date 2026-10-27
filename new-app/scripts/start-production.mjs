#!/usr/bin/env node
/**
 * Coolify start: apply Prisma migrations (retry/backoff), then Next.js standalone.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const newAppRoot = path.resolve(__dirname, "..");

const standaloneCandidates = [
  path.join(newAppRoot, ".next", "standalone", "server.js"),
  path.join(process.cwd(), ".next", "standalone", "server.js"),
  path.join(process.cwd(), "server.js"),
];

const standaloneServer = standaloneCandidates.find((p) => existsSync(p));

if (!standaloneServer) {
  console.error(
    `[new-app/start] Missing Next standalone server.js (checked: ${standaloneCandidates.join(", ")})`,
  );
  process.exit(1);
}

const migrateScript = path.join(__dirname, "run-db-migrations.mjs");

async function runMigrations() {
  if (process.env.SKIP_DB_MIGRATE_AT_START === "1") {
    console.warn("[new-app/start] SKIP_DB_MIGRATE_AT_START=1 — skipping migrations");
    return;
  }
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [migrateScript], {
      stdio: "inherit",
      env: process.env,
      cwd: newAppRoot,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`migrate exited ${code}`));
    });
  });
}

const hostname = process.env.HOSTNAME?.trim() || "0.0.0.0";
const port = process.env.PORT?.trim() || "3000";

async function startServer() {
  const child = spawn(process.execPath, [standaloneServer], {
    stdio: "inherit",
    env: {
      ...process.env,
      HOSTNAME: hostname,
      PORT: port,
    },
    cwd: path.dirname(standaloneServer),
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

runMigrations()
  .then(() => startServer())
  .catch((err) => {
    console.error("[new-app/start] migration bootstrap failed:", err.message || err);
    process.exit(1);
  });
