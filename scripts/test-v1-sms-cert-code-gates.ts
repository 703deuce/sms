/**
 * Static V1 certification gates — PR #276 code fixes without browser/DB.
 * Run: npx tsx scripts/test-v1-sms-cert-code-gates.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function src(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const header = src("src/components/layout/header.tsx");
assert.ok(!header.includes("WorkspaceModeToggle"), "header must not import WorkspaceModeToggle");

const settings = src("src/app/(app)/settings/page.tsx");
assert.ok(
  settings.includes("/settings/business"),
  "settings index must redirect to business settings",
);

const sendQuick = src("src/lib/sms/send-quick.ts");
assert.ok(
  sendQuick.includes("pickPreferredSmsSendingNumber"),
  "send-quick must use pickPreferredSmsSendingNumber",
);

const workspaceData = src("src/lib/workspace-data.ts");
assert.ok(
  workspaceData.includes("sortPhoneNumbersForSms") && workspaceData.includes("pickPreferredSmsSendingNumber"),
  "workspace shell must sort/filter numbers for SMS preference",
);
assert.ok(
  workspaceData.includes("active"),
  "workspace shell must filter to active numbers only",
);

const prismaCompat = src("src/lib/supabase/prisma-compat.ts");
assert.ok(
  prismaCompat.includes("Object.prototype.hasOwnProperty.call(r, meta.fk)"),
  "prisma-compat must treat nullable FK columns as parent-side relations",
);

const preferred = src("src/lib/messaging/preferred-sending-number.ts");
assert.ok(
  preferred.includes("HP_CERTIFIED_SMS_E164") && preferred.includes("+15714073615"),
  "preferred-sending-number must define HP certified 571",
);

console.log("test-v1-sms-cert-code-gates: ok");
