#!/usr/bin/env node
/**
 * Runs homepage search hydration tests against BASE_URL.
 * When BASE_URL is unset, starts the production server locally, waits for readiness, then shuts down.
 *
 * Usage:
 *   BASE_URL=https://transovo.ai node scripts/run-homepage-number-search-hydration.mjs
 *   node scripts/run-homepage-number-search-hydration.mjs
 */
import { spawn } from "node:child_process";
import { once } from "node:events";

const baseUrl = process.env.BASE_URL?.trim() || "http://127.0.0.1:3000";
const autoStart = process.env.HYDRATION_TEST_AUTO_START !== "0" && !process.env.BASE_URL?.trim();
const port = new URL(baseUrl).port || "3000";
const healthUrl = `${baseUrl.replace(/\/$/, "")}/`;

async function waitForServer(url, timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.ok || res.status === 307 || res.status === 308) return;
    } catch {
      // server still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

function spawnProcess(command, args, env = process.env) {
  const child = spawn(command, args, {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return child;
}

async function runTest() {
  const child = spawnProcess(process.execPath, [
    "scripts/test-homepage-number-search-hydration.mjs",
  ], {
    ...process.env,
    BASE_URL: baseUrl,
  });
  const [code] = await once(child, "exit");
  return code ?? 1;
}

let server;
try {
  if (autoStart) {
    console.log(`[hydration-runner] starting production server on port ${port}`);
    server = spawnProcess("npm", ["run", "start"], {
      ...process.env,
      PORT: port,
      HOSTNAME: "127.0.0.1",
    });
    await waitForServer(healthUrl);
    console.log(`[hydration-runner] server ready at ${healthUrl}`);
  } else {
    console.log(`[hydration-runner] using BASE_URL=${baseUrl}`);
    await waitForServer(healthUrl);
  }

  const code = await runTest();
  process.exit(code);
} catch (err) {
  console.error("[hydration-runner]", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  if (server && !server.killed) {
    server.kill("SIGTERM");
  }
}
