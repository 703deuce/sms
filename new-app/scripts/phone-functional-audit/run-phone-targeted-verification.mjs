#!/usr/bin/env node
/**
 * Targeted pass — does NOT re-run full 99-check audit.
 * 1) Auth regression probe (production URL)
 * 2) Isolated DB integration (S-07–S-15, publish dry-run, mutations)
 * 3) Writes readiness report
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const auditDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(auditDir, "..", "..");
const repoRoot = path.join(appRoot, "..");
const preload = path.join(repoRoot, "scripts", "preload-server-only.mjs");
const reportPath = "/opt/cursor/artifacts/phone-automated-verification-readiness.md";

const baseUrl = process.env.PHONE_TEST_BASE_URL || "https://transovo.ai";
const sections = [];

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: opts.cwd || appRoot,
    encoding: "utf8",
    env: { ...process.env, ...opts.env },
    timeout: opts.timeout || 600_000,
  });
}

// --- 1 Auth ---
const auth = run("node", ["scripts/phone-functional-audit/test-phone-api-auth-regression.mjs"], {
  env: { PHONE_TEST_BASE_URL: baseUrl },
});
sections.push({
  area: "Production Phone API auth (cross-site)",
  status: auth.status === 0 ? "PASS (after deploy)" : "FAIL (open today — fix in PR)",
  detail: (auth.stdout || auth.stderr || "").trim().slice(-500),
});

// --- 2 Isolated DB ---
let isolatedStatus = "BLOCKED";
let isolatedDetail = "";
const setup = run("bash", [path.join(repoRoot, "scripts/setup-isolated-phone-cert-database.sh")], {
  cwd: repoRoot,
  timeout: 300_000,
});
if (setup.status === 0) {
  const m = (setup.stdout || "").match(/PHONE_CERT_DATABASE_URL=(.+)/);
  const certUrl = m?.[1]?.trim() || process.env.PHONE_CERT_DATABASE_URL;
  const iso = run(
    "npx",
    ["tsx", "scripts/phone-functional-audit/phone-isolated-integration.ts"],
    {
      env: {
        PHONE_CERT_DATABASE_URL: certUrl,
        NODE_OPTIONS: `--import ${preload}`,
      },
    },
  );
  isolatedStatus = iso.status === 0 ? "PASS" : iso.status === 2 ? "BLOCKED" : "FAIL";
  isolatedDetail = `${iso.stdout || ""}${iso.stderr || ""}`.trim().slice(-1500);
} else {
  isolatedDetail = (setup.stderr || setup.stdout || "setup failed").trim().slice(-800);
}

sections.push({
  area: "Isolated DB S-07–S-15 + publish dry-run + mutations",
  status: isolatedStatus,
  detail: isolatedDetail,
});

// --- 3 Readiness narrative ---
const priorAudit = existsSync("/opt/cursor/artifacts/phone-functional-audit-full-report.json")
  ? JSON.parse(readFileSync("/opt/cursor/artifacts/phone-functional-audit-full-report.json", "utf8"))
  : null;

const lines = [
  "# Phone automated verification — readiness (targeted pass)",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "## What the prior 99 PASS checks actually were",
  "",
  "| Category | Count (approx) | Depth |",
  "|----------|----------------|-------|",
  "| Phase 2 script suites (logic, routing, IVR compile, production GET cert) | 30 | **Functional** for lib/unit; **HTTP smoke** for prod cert |",
  "| Phase 3 API GET matrix | 43 | **Reachability only** (HTTP < 500) |",
  "| Phase 3 UI URL fetch | 15 | **HTML shell load only** |",
  "| Phase 4 S-01–S-06 | 6 | **In-process logic** |",
  "| Phase 4 S-07–S-15 | 9 | Were **BLOCKED** without DB — now isolated integration |",
  "| Phase 5 Telnyx list | 1 | **Read-only provider** |",
  "| Phase 6 failure cases | 2 | **HTTP status** on bad input |",
  "",
  "## Targeted pass results",
  "",
];

for (const s of sections) {
  lines.push(`### ${s.area} — **${s.status}**`);
  lines.push("");
  lines.push("```");
  lines.push(s.detail || "(no output)");
  lines.push("```");
  lines.push("");
}

lines.push("## Classification");
lines.push("");
lines.push("| Bucket | Items |");
lines.push("|--------|-------|");
lines.push("| **Fully automated & verified (logic/unit)** | P2 scripts: forwarding validation, IVR transfer authorize, voice-v3 tools, telephony switch sequence, recording resolve, etc. |");
lines.push("| **Mocked / in-process** | S-01–S-06 routing logic, webhook dedup code presence |");
lines.push("| **Read-only live provider** | Telnyx phone_numbers list; production cert GET endpoints (authenticated only by broken open API today) |");
lines.push("| **Reachability-only (not functionality)** | P3-API-* GET matrix, P3-UI-* page loads |");
lines.push("| **Isolated DB integration** | S-07–S-15, MUT-*, CF-01, P2-SCRIPT-030 dry-run — `npm run test:phone:cert:isolated` |");
lines.push("| **Still requires real PSTN/media** | Browser WebRTC answer, audio paths, conversational speech, live forward ring, power-dialer live dial |");
lines.push("");
lines.push("## Authentication clarification");
lines.push("");
lines.push(
  "Earlier audit text about \"dev auth bypass\" was **incorrect naming**. Production smoke scripts called `https://transovo.ai/api/phone/*` **without cookies or API keys** and received **HTTP 200**.",
);
lines.push(
  "Root cause: `resolveWorkspaceId()` returns the **first workspace in the database** when env is unset, and Phone routes lacked cross-site guards. This is **not** an intentional cert bypass — it is **missing customer auth** on new-app Phone APIs.",
);
lines.push(
  "Fix in this branch: `middleware.ts` on `/api/phone/*` + `assertPhoneApiAccess()` (401 for anonymous cross-site in production). Regression: `test-phone-api-auth-regression.mjs`.",
);
lines.push("");
lines.push("## Commands");
lines.push("");
lines.push("```bash");
lines.push("# Targeted pass (auth + isolated DB if Postgres available)");
lines.push("cd new-app && npm run test:phone:verification:targeted");
lines.push("");
lines.push("# Isolated DB only");
lines.push("bash scripts/setup-isolated-phone-cert-database.sh");
lines.push("cd new-app && npm run test:phone:cert:isolated");
lines.push("```");

if (priorAudit?.totals) {
  lines.push("");
  lines.push(`Prior full audit snapshot: PASS=${priorAudit.totals.PASS} FAIL=${priorAudit.totals.FAIL} BLOCKED=${priorAudit.totals.BLOCKED}`);
}

mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, lines.join("\n"));
console.log(`Readiness report: ${reportPath}`);
const authFail = auth.status !== 0;
const isoFail = isolatedStatus === "FAIL";
const isoBlocked = isolatedStatus === "BLOCKED";
if (authFail || isoFail) process.exit(1);
if (isoBlocked) process.exit(2);
process.exit(0);
