#!/usr/bin/env node
/**
 * Thin wrapper — runs the TypeScript automation trigger suite.
 * Approved test phones are embedded in scripts/test-automation-triggers.ts.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tsScript = path.join(__dirname, "test-automation-triggers.ts");

const result = spawnSync(
  "npx",
  ["tsx", tsScript],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: "--import ./scripts/preload-server-only.mjs",
    },
    cwd: path.join(__dirname, ".."),
  },
);

process.exit(result.status ?? 1);
