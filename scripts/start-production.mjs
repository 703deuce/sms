#!/usr/bin/env node
/**
 * Production start: Next standalone server + embedded job worker in the same container.
 *
 * Coolify start command stays `node scripts/start-production.mjs` — no extra services.
 * The job worker is a sibling process (worker:all); Next.js gets DISABLE_INPROCESS_WORKER=1
 * so we never double-drain the queue.
 *
 * Node web boot (voice/messaging reconcilers) runs here via scripts/node-web-boot.ts —
 * NOT from src/instrumentation.ts (keeps webpack instrumentation bundle Edge-safe).
 *
 * Opt out: EMBEDDED_JOB_WORKER=0 (falls back to in-process poller — not recommended in prod).
 */
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const standaloneServer = path.join(process.cwd(), ".next", "standalone", "server.js");
const repoRoot = process.cwd();

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];

function productionEnv() {
  const hostname = process.env.HOSTNAME?.trim() || "0.0.0.0";
  const port = process.env.PORT?.trim() || "3000";
  return {
    ...process.env,
    HOSTNAME: hostname,
    PORT: port,
  };
}

function embeddedJobWorkerEnabled() {
  if (process.env.EMBEDDED_JOB_WORKER === "0") return false;
  if (process.env.DISABLE_INPROCESS_WORKER === "1" && process.env.EMBEDDED_JOB_WORKER !== "1") {
    // Explicit external worker — do not spawn another.
    return false;
  }
  return true;
}

function shutdownAll(signal = "SIGTERM") {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

function spawnTracked(label, command, args, options = {}) {
  const child = spawn(command, args, { stdio: "inherit", ...options });
  children.push(child);
  child.on("exit", (code, signal) => {
    console.log(`[start] ${label} exited code=${code ?? "null"} signal=${signal ?? "null"}`);
    shutdownAll("SIGTERM");
    process.exit(code ?? (signal ? 1 : 0));
  });
  return child;
}

process.on("SIGINT", () => shutdownAll("SIGINT"));
process.on("SIGTERM", () => shutdownAll("SIGTERM"));

const baseEnv = productionEnv();

function runNodeWebBoot() {
  console.log("[start] running node web boot (scripts/node-web-boot.ts)");
  const result = spawnSync(
    "npx",
    ["tsx", "scripts/node-web-boot.ts"],
    { cwd: repoRoot, stdio: "inherit", env: baseEnv },
  );
  if (result.status !== 0) {
    console.error("[start] node-web-boot exited with status", result.status ?? "null");
    process.exit(result.status ?? 1);
  }
}

runNodeWebBoot();

const useEmbeddedWorker = embeddedJobWorkerEnabled();
const webEnv = useEmbeddedWorker
  ? { ...baseEnv, DISABLE_INPROCESS_WORKER: "1" }
  : baseEnv;

if (useEmbeddedWorker) {
  const workerEnv = {
    ...baseEnv,
    NODE_OPTIONS: [
      baseEnv.NODE_OPTIONS,
      "--import ./scripts/preload-server-only.mjs",
    ]
      .filter(Boolean)
      .join(" "),
  };
  console.log("[start] spawning embedded job worker (npm run worker:all) in same container");
  spawnTracked("job-worker", "npx", ["tsx", "scripts/worker-all.ts"], {
    env: workerEnv,
    cwd: repoRoot,
  });
} else {
  console.log("[start] embedded job worker disabled — using in-process poller in Next.js");
}

if (existsSync(standaloneServer)) {
  console.log(
    `[start] using Next standalone server at .next/standalone/server.js (HOSTNAME=${baseEnv.HOSTNAME} PORT=${baseEnv.PORT})`,
  );
  spawnTracked("web", process.execPath, [standaloneServer], {
    env: webEnv,
    cwd: path.join(repoRoot, ".next", "standalone"),
  });
} else {
  console.warn("[start] standalone server missing — falling back to next start");
  spawnTracked("web", "npx", ["next", "start"], {
    env: webEnv,
    cwd: repoRoot,
  });
}
