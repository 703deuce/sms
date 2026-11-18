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

  startMotionStudioAutoSweep();
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

/**
 * Motion Studio coordinator sweep, run by the web server itself (DB-only).
 * Requeues expired leases and dispatches queued work. It never contacts a
 * producer unless a job is actually waiting, so producers need no heartbeat.
 */
function startMotionStudioAutoSweep() {
  const key = process.env.MOTION_STUDIO_COORDINATOR_ADMIN_KEY || "";
  if (process.env.MOTION_STUDIO_COORDINATOR !== "1" || key.length < 32) return;
  if (process.env.MOTION_STUDIO_AUTO_SWEEP === "0") return;
  const everyMs = Math.max(30_000, Number(process.env.MOTION_STUDIO_AUTO_SWEEP_MS) || 60_000);
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/motion-studio/agent/coordinator`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sweep: true }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) console.warn("[new-app/start] motion-studio auto sweep HTTP", res.status);
    } catch (err) {
      console.warn("[new-app/start] motion-studio auto sweep failed:", err?.name || "error");
    } finally {
      running = false;
    }
  };
  setTimeout(() => {
    tick();
    setInterval(tick, everyMs).unref?.();
  }, 90_000).unref?.();
}

runMigrations()
  .then(() => startServer())
  .catch((err) => {
    console.error("[new-app/start] migration bootstrap failed:", err.message || err);
    process.exit(1);
  });
