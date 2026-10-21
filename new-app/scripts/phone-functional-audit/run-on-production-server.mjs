#!/usr/bin/env node
/**
 * Run the 10 DB-blocked phone audit checks using production credentials.
 *
 * Production web containers are Next standalone (no tsx/scripts). This script:
 * 1. SSHs to the Coolify host (COOLIFY_SSH_KEY or COOLIFY_SSH_KEY_PATH)
 * 2. Reads DATABASE_URL from the running web container
 * 3. Runs run-server-db-blocked-audit.ts in this repo checkout with that URL
 *
 * Usage:
 *   node new-app/scripts/phone-functional-audit/run-on-production-server.mjs
 *
 * Env:
 *   COOLIFY_SSH_KEY — PEM private key (Cursor secret)
 *   COOLIFY_SSH_HOST — default 128.140.102.51
 *   MCTB_PROD_WEB_CONTAINER_FILTER — default ds8s3hjin60qs6g7s0iqkixs
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dir, "..", "..");
const repoRoot = path.join(appRoot, "..");
const preload = path.join(repoRoot, "scripts", "preload-server-only.mjs");
const auditTs = path.join(__dir, "run-server-db-blocked-audit.ts");

const CONTAINER_FILTER =
  process.env.MCTB_PROD_WEB_CONTAINER_FILTER?.trim() || "ds8s3hjin60qs6g7s0iqkixs";

function reflowPem(oneLine) {
  if (oneLine.includes("\n")) return oneLine;
  const begin = oneLine.match(/-----BEGIN [^-]+-----/);
  const end = oneLine.match(/-----END [^-]+-----/);
  if (!begin || !end || begin.index == null || end.index == null) return oneLine;
  const body = oneLine.slice(begin.index + begin[0].length, end.index).replace(/\s+/g, "");
  const lines = [begin[0]];
  for (let i = 0; i < body.length; i += 64) lines.push(body.slice(i, i + 64));
  lines.push(end[0]);
  return `${lines.join("\n")}\n`;
}

function ensureSshKey() {
  const pathFromEnv = process.env.COOLIFY_SSH_KEY_PATH?.trim();
  if (pathFromEnv) return pathFromEnv;

  const inline = process.env.COOLIFY_SSH_KEY?.trim();
  if (!inline) return null;

  const keyPath = path.join(homedir(), ".ssh", "cursor_coolify");
  mkdirSync(path.dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, reflowPem(inline));
  chmodSync(keyPath, 0o600);
  return keyPath;
}

function fetchDatabaseUrlFromProduction(keyPath) {
  const host = process.env.COOLIFY_SSH_HOST?.trim() || "128.140.102.51";
  const user = process.env.COOLIFY_SSH_USER?.trim() || "root";
  const remote = [
    "set -euo pipefail",
    `cid=$(docker ps --filter name=${CONTAINER_FILTER} --format '{{.ID}}' | head -1)`,
    'if [ -z "$cid" ]; then echo "NO_CONTAINER"; exit 3; fi',
    'docker exec "$cid" printenv DATABASE_URL 2>/dev/null || true',
  ].join("; ");

  const r = spawnSync(
    "ssh",
    [
      "-i",
      keyPath,
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "ConnectTimeout=30",
      `${user}@${host}`,
      "bash",
      "-lc",
      remote,
    ],
    { encoding: "utf8", maxBuffer: 256_000 },
  );

  const out = (r.stdout || "").trim();
  if (r.status !== 0 || !out || out === "NO_CONTAINER") {
    console.error(
      "Could not read DATABASE_URL from production web container.",
      r.stderr?.slice(0, 500) || "",
    );
    return null;
  }
  return out.split("\n").pop()?.trim() || null;
}

function runLocalAudit(databaseUrl) {
  const r = spawnSync("npx", ["tsx", auditTs], {
    cwd: appRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      NODE_OPTIONS: `--import ${preload}`,
    },
  });
  process.exit(r.status ?? 1);
}

if (process.env.DATABASE_URL?.trim()) {
  console.info("[run-on-production-server] DATABASE_URL already set — running audit locally.");
  runLocalAudit(process.env.DATABASE_URL.trim());
}

const keyPath = ensureSshKey();
if (!keyPath) {
  console.error(
    "Set COOLIFY_SSH_KEY (Cursor secret) or COOLIFY_SSH_KEY_PATH, or DATABASE_URL to run server DB audit.",
  );
  process.exit(2);
}

const databaseUrl = fetchDatabaseUrlFromProduction(keyPath);
if (!databaseUrl) process.exit(3);

console.info("[run-on-production-server] Loaded DATABASE_URL from production container (value not printed).");
runLocalAudit(databaseUrl);
