import assert from "node:assert/strict";
import {
  displayNumber,
  formatNumberTypeLabel,
  messagingUiLabel,
  tfvTone,
} from "../src/lib/mctb/number-management-model";

const row = {
  id: "1",
  e164: "+18885550199",
  friendlyName: "MCTB",
  type: "toll_free",
  provider: "telnyx",
  status: "Active",
  messagingStatus: { approved: false, label: "Verification required" },
};

assert.equal(formatNumberTypeLabel("toll_free"), "Toll-free");
assert.equal(messagingUiLabel(row).tone, "pending");
assert.equal(tfvTone("APPROVED", true), "ready");
assert.ok(displayNumber("+15715550142").includes("571"));

console.log("test-mctb-number-management: ok");
