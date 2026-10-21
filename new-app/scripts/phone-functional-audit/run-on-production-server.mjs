#!/usr/bin/env node
/**
 * Run the 10 DB-blocked phone audit checks using production DATABASE_URL (read-only scenarios)
 * or PHONE_CERT_DATABASE_URL when set (isolated integration — preferred).
 *
 * SSH: scripts/cloud-agent/ensure-coolify-ssh.sh
 *   Secrets: TRANSOVO_SSH_PRIVATE_KEY | TRANSOVO_SSH_KEY | COOLIFY_SSH_KEY
 *   Default user: cursor-agent@128.140.102.51 (docker group) or COOLIFY_SSH_USER=root
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dir, "..", "..");
const repoRoot = path.join(appRoot, "..");
const preload = path.join(repoRoot, "scripts", "preload-server-only.mjs");
const auditTs = path.join(__dir, "run-server-db-blocked-audit.ts");
const isolatedTs = path.join(__dir, "phone-isolated-integration.ts");
const ensureSsh = path.join(repoRoot, "scripts/cloud-agent/ensure-coolify-ssh.sh");

const CONTAINER_FILTER =
  process.env.MCTB_PROD_WEB_CONTAINER_FILTER?.trim() || "ds8s3hjin60qs6g7s0iqkixs";

function ensureSshSession() {
  const r = spawnSync("bash", [ensureSsh], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    return false;
  }
  return true;
}

function sshAlias() {
  return process.env.COOLIFY_SSH_HOST_ALIAS || "coolify-server";
}

function fetchDatabaseUrlFromProduction() {
  const remote = [
    "set -euo pipefail",
    `cid=$(docker ps --filter name=${CONTAINER_FILTER} --format '{{.ID}}' | head -1)`,
    'if [ -z "$cid" ]; then echo "NO_CONTAINER"; exit 3; fi',
    'docker exec "$cid" printenv DATABASE_URL 2>/dev/null || true',
  ].join("; ");

  const r = spawnSync("ssh", [sshAlias(), "bash", "-lc", remote], {
    encoding: "utf8",
    maxBuffer: 256_000,
  });

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

function ensureIsolatedPostgresOnServer() {
  const remote = [
    "set -euo pipefail",
    "NAME=transovo-phone-cert-pg",
    "if ! docker ps --format '{{.Names}}' | grep -qx \"$NAME\"; then",
    "  docker rm -f \"$NAME\" 2>/dev/null || true",
    "  docker run -d --name \"$NAME\" -e POSTGRES_USER=phone_cert -e POSTGRES_PASSWORD=phone_cert_local_only -e POSTGRES_DB=transovo_phone_cert -p 127.0.0.1:5434:5432 postgres:15-alpine",
    "  sleep 3",
    "fi",
    'echo "postgresql://phone_cert:phone_cert_local_only@127.0.0.1:5434/transovo_phone_cert"',
  ].join("\n");

  const r = spawnSync("ssh", [sshAlias(), "bash", "-lc", remote], {
    encoding: "utf8",
    maxBuffer: 64_000,
  });
  const line = (r.stdout || "").trim().split("\n").pop()?.trim();
  if (r.status !== 0 || !line?.startsWith("postgresql://")) {
    console.error("Could not start isolated Postgres on server.", r.stderr?.slice(0, 400));
    return null;
  }
  return line;
}

function runLocalScript(scriptPath, envExtra = {}) {
  const r = spawnSync("npx", ["tsx", scriptPath], {
    cwd: appRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      ...envExtra,
      NODE_OPTIONS: `--import ${preload}`,
    },
  });
  process.exit(r.status ?? 1);
}

function runPrismaPush(certUrl) {
  const r = spawnSync("npx", ["prisma", "db", "push", "--accept-data-loss", "--skip-generate"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: certUrl },
  });
  return r.status === 0;
}

// Prefer isolated cert DB (synthetic data) when we can reach the server.
if (process.env.PHONE_CERT_DATABASE_URL?.trim()) {
  const certUrl = process.env.PHONE_CERT_DATABASE_URL.trim();
  if (!runPrismaPush(certUrl)) process.exit(4);
  console.info("[run-on-production-server] PHONE_CERT_DATABASE_URL set — isolated integration.");
  runLocalScript(isolatedTs, { PHONE_CERT_DATABASE_URL: certUrl });
}

if (!ensureSshSession()) {
  console.error(
    "SSH failed. Set TRANSOVO_SSH_PRIVATE_KEY (or COOLIFY_SSH_KEY) or use ~/.ssh/cursor_hetzner_ed25519.",
  );
  process.exit(2);
}

const localPort = process.env.PHONE_CERT_LOCAL_PORT || "5434";
const tunnel = spawnSync(
  "ssh",
  [
    "-f",
    "-N",
    "-o",
    "ExitOnForwardFailure=yes",
    "-L",
    `127.0.0.1:${localPort}:127.0.0.1:5434`,
    sshAlias(),
  ],
  { encoding: "utf8" },
);
if (tunnel.status !== 0) {
  console.error("SSH tunnel to cert Postgres failed.", tunnel.stderr);
  process.exit(3);
}

const serverCertUrl = ensureIsolatedPostgresOnServer();
if (!serverCertUrl) process.exit(4);

const localCertUrl = `postgresql://phone_cert:phone_cert_local_only@127.0.0.1:${localPort}/transovo_phone_cert`;
if (!runPrismaPush(localCertUrl)) process.exit(5);

console.info("[run-on-production-server] Running isolated integration via SSH-tunneled cert Postgres.");
runLocalScript(isolatedTs, { PHONE_CERT_DATABASE_URL: localCertUrl });
