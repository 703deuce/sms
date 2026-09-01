#!/usr/bin/env tsx
/**
 * Regression tests for /fax public vs authenticated routing contract.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type Row = { name: string; pass: boolean; detail?: string };
const rows: Row[] = [];

function pass(name: string, ok: boolean, detail?: string) {
  rows.push({ name, pass: ok, detail });
}

const mw = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");

pass("Public landing at app/fax/page.tsx", existsSync("src/app/fax/page.tsx"));
pass(
  "Authenticated overview at /fax/overview",
  existsSync("src/app/(app)/fax/overview/page.tsx"),
);
pass(
  "No duplicate /fax page under (app)",
  !existsSync("src/app/(app)/fax/page.tsx"),
);
pass("/fax in publicExact allowlist", mw.includes('"/fax"'));
pass(
  "Logged-in /fax redirects to /fax/overview",
  mw.includes('pathname === "/fax"') && mw.includes('"/fax/overview"'),
);
pass(
  "phone-verification blocked when Verify dormant",
  mw.includes("phone-verification") && mw.includes("isVerifyLaunchEnabled"),
);

const subnav = readFileSync(join(process.cwd(), "src/components/fax/fax-subnav.tsx"), "utf8");
pass("Subnav overview href is /fax/overview", subnav.includes('href: "/fax/overview"'));

console.log("\n=== Fax Routing Regression ===\n");
for (const row of rows) {
  console.log(`${row.pass ? "PASS" : "FAIL"}  ${row.name}${row.detail ? ` — ${row.detail}` : ""}`);
}
const failed = rows.filter((r) => !r.pass).length;
console.log(`\n${rows.length - failed}/${rows.length} passed`);
if (failed) process.exit(1);
