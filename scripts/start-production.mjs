#!/usr/bin/env node
/**
 * Production start: prefer Next standalone server when present (Coolify/Nixpacks).
 * Falls back to next start for local prod smoke tests.
 */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const standaloneServer = path.join(process.cwd(), ".next", "standalone", "server.js");

if (existsSync(standaloneServer)) {
  console.log("[start] using Next standalone server at .next/standalone/server.js");
  const child = spawn(process.execPath, [standaloneServer], {
    stdio: "inherit",
    env: process.env,
    cwd: path.join(process.cwd(), ".next", "standalone"),
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
  return;
}

console.warn("[start] standalone server missing — falling back to next start");
const child = spawn("npx", ["next", "start"], { stdio: "inherit", env: process.env });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
