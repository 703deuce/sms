#!/usr/bin/env node
/** @deprecated Use run-full-audit.mjs — this wrapper runs the full suite. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const auditDir = path.dirname(fileURLToPath(import.meta.url));
const full = path.join(auditDir, "run-full-audit.mjs");
const r = spawnSync(process.execPath, [full], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
