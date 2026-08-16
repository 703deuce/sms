#!/usr/bin/env node
/**
 * Production start: prefer Next standalone server when present (Coolify/Nixpacks).
 * Falls back to next start for local prod smoke tests.
 */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const standaloneServer = path.join(process.cwd(), ".next", "standalone", "server.js");

function attachExitForwarding(child) {
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

function productionEnv() {
  const hostname = process.env.HOSTNAME?.trim() || "0.0.0.0";
  const port = process.env.PORT?.trim() || "3000";
  return {
    ...process.env,
    HOSTNAME: hostname,
    PORT: port,
  };
}

const env = productionEnv();

if (existsSync(standaloneServer)) {
  console.log(
    `[start] using Next standalone server at .next/standalone/server.js (HOSTNAME=${env.HOSTNAME} PORT=${env.PORT})`,
  );
  const child = spawn(process.execPath, [standaloneServer], {
    stdio: "inherit",
    env,
    cwd: path.join(process.cwd(), ".next", "standalone"),
  });
  attachExitForwarding(child);
} else {
  console.warn("[start] standalone server missing — falling back to next start");
  const child = spawn("npx", ["next", "start"], { stdio: "inherit", env });
  attachExitForwarding(child);
}
