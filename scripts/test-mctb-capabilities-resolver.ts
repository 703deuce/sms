import assert from "node:assert/strict";
import {
  currentMctbRecoveryPeriodKey,
  MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
} from "../src/lib/mctb/recovery-usage-constants";
import { getMctbPlatformTemplate } from "../src/lib/mctb/platform-message-templates";

assert.match(currentMctbRecoveryPeriodKey(new Date("2026-09-15T12:00:00Z")), /^\d{4}-\d{2}$/);
assert.equal(MCTB_FREE_MONTHLY_RECOVERY_LIMIT, 25);

const opener = getMctbPlatformTemplate("recovery_opener");
assert.ok(opener.body.length > 20);
assert.equal(opener.senderOwnership, "TRANSOVO_PLATFORM");

console.log("test-mctb-capabilities-resolver: PASS");
