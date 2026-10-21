#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const auditDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(auditDir, "..", "..");
const repoRoot = path.join(appRoot, "..");
const preload = path.join(repoRoot, "scripts", "preload-server-only.mjs");

if (!process.env.PHONE_CERT_DATABASE_URL?.trim()) {
  const setup = spawnSync("bash", [path.join(repoRoot, "scripts/setup-isolated-phone-cert-database.sh")], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (setup.status !== 0) {
    console.error(setup.stderr || setup.stdout);
    process.exit(setup.status || 2);
  }
  const m = (setup.stdout || "").match(/PHONE_CERT_DATABASE_URL=(.+)/);
  if (m) process.env.PHONE_CERT_DATABASE_URL = m[1].trim();
}

const r = spawnSync(
  "npx",
  ["tsx", path.join(auditDir, "phone-isolated-integration.ts")],
  {
    cwd: appRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: `--import ${preload}`,
    },
  },
);
process.exit(r.status ?? 1);
