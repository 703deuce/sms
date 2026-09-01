#!/usr/bin/env tsx
/**
 * Dormant Verify — preserved implementation checks (NOT a V1 launch gate).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isVerifyLaunchEnabled, V1_PRODUCT_STATUS } from "../src/lib/products/v1-product-status";
import { verificationResultMeaning } from "../src/lib/verify/phone-verification-result";
import { normalizeLineType, normalizeVerifyPhone } from "../src/lib/verify/phone-normalization";
import { parseCsv, suggestPhoneColumn } from "../src/lib/verify/csv";

type Row = { name: string; pass: boolean; detail?: string };
const rows: Row[] = [];

function pass(name: string, ok: boolean, detail?: string) {
  rows.push({ name, pass: ok, detail });
}

function fileExists(rel: string) {
  return existsSync(join(process.cwd(), rel));
}

function srcIncludes(rel: string, needle: string) {
  return readFileSync(join(process.cwd(), rel), "utf8").includes(needle);
}

pass("VERIFY: marked dormant in V1 status", V1_PRODUCT_STATUS.verify === "dormant");
pass("VERIFY: default launch disabled", !isVerifyLaunchEnabled());
pass("VERIFY SINGLE API preserved", fileExists("src/app/api/verify/lookup/route.ts"));
pass("VERIFY BULK API preserved", fileExists("src/app/api/verify/bulk/route.ts"));
pass("VERIFY: canonical verifyPhoneNumber", fileExists("src/lib/verify/verify-phone-number.ts"));
pass("VERIFY: provider abstraction", fileExists("src/lib/verify/phone-verification-result.ts"));
pass("VERIFY: purchase guard", srcIncludes("src/lib/verify/verify-billing.ts", "assertVerifyCustomerAccess"));

const norm = normalizeVerifyPhone("(703) 555-1212");
pass("VERIFY NORMALIZATION US", norm.ok && norm.e164 === "+17035551212");

const csv = parseCsv("phone,name\n7035551212,Jane\n");
pass("CSV PARSE", csv.headers[0] === "phone" && suggestPhoneColumn(csv.headers) === "phone");

const meaning = verificationResultMeaning({
  lineTypeDisplay: "Mobile",
  carrier: "Verizon Wireless",
  reachability: "not_tested",
  formatValid: true,
});
pass("Result meaning / reachability disclaimer", meaning.includes("not tested"));

pass(
  "VoIP classification",
  normalizeLineType("non-fixed voip") === "non_fixed_voip" &&
    normalizeLineType("fixed voip") === "fixed_voip",
);
pass("Bulk deduplication", srcIncludes("src/lib/verify/bulk-verify-service.ts", "duplicateRows"));
pass(
  "Partial failure recovery",
  fileExists("src/app/api/verify/jobs/[id]/retry-failed/route.ts"),
);
pass("Mobile-only export", srcIncludes("src/lib/verify/verify-export.ts", 'filter === "mobile"'));

async function main() {
  if (process.env.TELNYX_LIVE_TEST === "1") {
    try {
      const { telnyxNumberLookup } = await import("../src/lib/verify/telnyx-lookup-client");
      const data = await telnyxNumberLookup("+17035551212");
      pass("LIVE TELNYX LOOKUP", Boolean(data));
    } catch (err) {
      pass("LIVE TELNYX LOOKUP", false, err instanceof Error ? err.message : String(err));
    }
  }

  console.log("\n=== Verify (Dormant) Preserved Implementation ===\n");
  for (const row of rows) {
    console.log(`${row.pass ? "PASS" : "FAIL"}  ${row.name}${row.detail ? ` — ${row.detail}` : ""}`);
  }
  const failed = rows.filter((r) => !r.pass).length;
  console.log(`\n${rows.length - failed}/${rows.length} passed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
