#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { shouldSkipInboxAwayAutoReply } from "@/lib/mctb/messaging/skip-inbox-away";

async function main() {
  const mctbDid = process.env.MCTB_TEST_DID_E164 || "+15714073615";
  const skip = await shouldSkipInboxAwayAutoReply({
    workspaceId: process.env.WORKSPACE_ID || "ws_1",
    fromE164: process.env.CUSTOMER_PHONE_E164 || "+15555550100",
    toE164: mctbDid,
  });
  assert.equal(skip, true, "MCTB DID must skip inbox away auto-reply");
  console.log("test-mctb-skip-inbox-away: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
