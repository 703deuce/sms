import assert from "node:assert/strict";
import {
  isPowerDialerAdminRole,
  userCanAccessCampaign,
} from "../lib/server/phone/power-dialer/campaign-access";

assert.equal(isPowerDialerAdminRole("OWNER"), true);
assert.equal(isPowerDialerAdminRole("MEMBER"), false);

assert.equal(
  userCanAccessCampaign("MEMBER", { ownerUserId: "u1", memberUserIds: ["u2"] }, "u1"),
  true,
);
assert.equal(
  userCanAccessCampaign("MEMBER", { ownerUserId: "u1", memberUserIds: ["u2"] }, "u2"),
  true,
);
assert.equal(
  userCanAccessCampaign("MEMBER", { ownerUserId: "u1", memberUserIds: ["u2"] }, "u3"),
  false,
);
assert.equal(
  userCanAccessCampaign("OWNER", { ownerUserId: "u1", memberUserIds: [] }, "u3"),
  true,
);

console.log("authorization-campaign-access: PASS");
