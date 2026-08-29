/**
 * SMS platform navigation structure — V1 consolidated nav.
 * Run: npx tsx scripts/test-sms-platform-nav.ts
 */
import assert from "node:assert/strict";
import { buildSmsPlatformNav } from "../src/lib/products/sms-platform-nav";
import { listGrowthTabs } from "../src/lib/list-growth-tabs";

const smsNav = buildSmsPlatformNav({ conversationsBadge: 2 });
const smsLabels = smsNav.map((i) => i.label);
const smsHrefs = smsNav.map((i) => i.href);

assert.ok(smsNav.find((i) => i.label === "Conversations")?.href === "/conversations");
assert.ok(!smsLabels.includes("Inbox"));
assert.ok(!smsLabels.includes("Media library"));
assert.ok(!smsLabels.includes("Reports"));
assert.ok(!smsHrefs.includes("/grow/contests"));
assert.ok(!smsHrefs.includes("/grow/sources"));
assert.ok(!smsHrefs.includes("/messaging/media"));
const listGrowth = smsNav.find((i) => i.label === "List Growth");
assert.ok(listGrowth, "List Growth nav group exists");
for (const child of listGrowth?.children || []) {
  assert.ok(child.href, `List Growth child missing href: ${child.label}`);
}
for (const tab of listGrowthTabs) {
  const child = listGrowth?.children?.find((c) => c.href === tab.href);
  assert.ok(child, `List Growth tab missing in nav: ${tab.label}`);
}
assert.ok(smsLabels.includes("Keywords"));
assert.ok(smsLabels.includes("Account"));

console.log("test-sms-platform-nav: ok");
