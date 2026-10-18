#!/usr/bin/env node
/**
 * Coolify start: Next.js standalone only (no BullMQ worker, no Prisma boot).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const standaloneServer = path.join(process.cwd(), ".next", "standalone", "server.js");

if (!existsSync(standaloneServer)) {
  console.error(
    `[new-app/start] Missing ${standaloneServer} — run production build first.`,
  );
  process.exit(1);
}

const hostname = process.env.HOSTNAME?.trim() || "0.0.0.0";
const port = process.env.PORT?.trim() || "3000";

const child = spawn(process.execPath, [standaloneServer], {
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: hostname,
    PORT: port,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
