#!/usr/bin/env npx tsx
/**
 * Capture MCTB regression baseline before/after Smart Routing changes.
 *
 * Usage:
 *   npx tsx scripts/mctb-regression-baseline.ts --write
 *   npx tsx scripts/mctb-regression-baseline.ts --compare docs/snapshots/mctb-regression-baseline.json
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_OUT = resolve("docs/snapshots/mctb-regression-baseline.json");

const TESTS: Array<{ name: string; cmd: string }> = [
  {
    name: "mctb-sip-ingress-send-gate",
    cmd: "npm run test:mctb-sip-ingress-send-gate",
  },
  {
    name: "mctb-consent-log",
    cmd: "npm run test:mctb-consent-log",
  },
  {
    name: "mctb-press1-consent-db",
    cmd:
      "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-press1-consent-db.ts",
  },
  {
    name: "mctb-sip-e2e-trace",
    cmd:
      "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-sip-e2e-trace.ts",
  },
];

type Row = { name: string; ok: boolean; output: string };

function runTests(): Row[] {
  return TESTS.map((t) => {
    try {
      const output = execSync(t.cmd, { encoding: "utf8", stdio: "pipe" });
      return { name: t.name, ok: true, output: output.trim() };
    } catch (err) {
      const output =
        err instanceof Error && "stdout" in err
          ? String((err as { stdout?: string }).stdout || err.message)
          : String(err);
      return { name: t.name, ok: false, output: output.trim() };
    }
  });
}

function writeBaseline(path: string) {
  const rows = runTests();
  const payload = {
    capturedAt: new Date().toISOString(),
    allPass: rows.every((r) => r.ok),
    rows,
  };
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2));
  console.log(`Wrote baseline to ${path}`);
  for (const row of rows) {
    console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}`);
  }
  if (!payload.allPass) process.exit(1);
}

function compareBaseline(path: string) {
  if (!existsSync(path)) {
    console.error(`Baseline not found: ${path}`);
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(path, "utf8")) as {
    capturedAt: string;
    rows: Row[];
  };
  const current = runTests();
  let failed = false;
  for (const row of current) {
    const prior = baseline.rows.find((r) => r.name === row.name);
    const status = row.ok ? "PASS" : "FAIL";
    const regressed = prior?.ok === true && !row.ok;
    if (!row.ok || regressed) failed = true;
    console.log(
      `${status} ${row.name}${regressed ? " (REGRESSION vs baseline)" : ""}`,
    );
  }
  console.log(`Baseline captured: ${baseline.capturedAt}`);
  if (failed) process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes("--write")) {
  const outIdx = args.indexOf("--out");
  writeBaseline(outIdx >= 0 ? args[outIdx + 1] : DEFAULT_OUT);
} else if (args.includes("--compare")) {
  const idx = args.indexOf("--compare");
  compareBaseline(args[idx + 1] || DEFAULT_OUT);
} else {
  console.log("Usage: --write | --compare [path]");
  process.exit(1);
}
