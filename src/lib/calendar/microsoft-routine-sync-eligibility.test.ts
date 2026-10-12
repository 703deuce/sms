import assert from "node:assert/strict";
import {
  isEligibleForRoutineMicrosoftCalendarSync,
  microsoftConnectionHasStoredCredentials,
} from "./microsoft-routine-sync-eligibility";

assert.equal(
  microsoftConnectionHasStoredCredentials({ refreshToken: "rt" }, null),
  true,
);
assert.equal(
  microsoftConnectionHasStoredCredentials({}, null),
  false,
);

assert.deepEqual(
  isEligibleForRoutineMicrosoftCalendarSync({
    id: "c1",
    status: "needs_reauth",
    credentialsRef: null,
    config: { syncEnabled: true, importCalendarIds: ["primary"] },
  }),
  { eligible: false, reason: "needs_reauth_no_credentials" },
);

assert.deepEqual(
  isEligibleForRoutineMicrosoftCalendarSync({
    id: "c2",
    status: "needs_reauth",
    credentialsRef: "cred-ref",
    config: {},
  }),
  { eligible: true },
);

assert.deepEqual(
  isEligibleForRoutineMicrosoftCalendarSync({
    id: "c3",
    status: "connected",
    credentialsRef: null,
    config: { refreshToken: "x" },
  }),
  { eligible: true },
);

console.log("microsoft-routine-sync-eligibility.test.ts PASS");
