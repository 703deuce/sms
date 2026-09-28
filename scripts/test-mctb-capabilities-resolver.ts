import assert from "node:assert/strict";
import {
  currentMctbRecoveryPeriodKey,
  MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
  MCTB_PAID_RECOVERY_LIMIT_BY_TIER,
  resolveMctbMonthlyRecoveryLimit,
} from "../src/lib/mctb/recovery-usage-constants";
import { getMctbPlatformTemplate } from "../src/lib/mctb/platform-message-templates";

assert.match(currentMctbRecoveryPeriodKey(new Date("2026-09-15T12:00:00Z")), /^\d{4}-\d{2}$/);
assert.equal(MCTB_FREE_MONTHLY_RECOVERY_LIMIT, 25);

assert.equal(
  resolveMctbMonthlyRecoveryLimit({
    mctbProductActive: true,
    recoveryPaid: false,
    paidTier: null,
  }),
  25,
);
assert.equal(
  resolveMctbMonthlyRecoveryLimit({
    mctbProductActive: true,
    recoveryPaid: true,
    paidTier: "growth",
  }),
  MCTB_PAID_RECOVERY_LIMIT_BY_TIER.growth,
);
assert.equal(
  resolveMctbMonthlyRecoveryLimit({
    mctbProductActive: true,
    recoveryPaid: true,
    paidTier: null,
  }),
  MCTB_PAID_RECOVERY_LIMIT_BY_TIER.starter,
);
assert.equal(
  resolveMctbMonthlyRecoveryLimit({
    mctbProductActive: false,
    recoveryPaid: true,
    paidTier: "pro",
  }),
  0,
);

const opener = getMctbPlatformTemplate("recovery_opener");
assert.ok(opener.body.length > 20);
assert.equal(opener.senderOwnership, "TRANSOVO_PLATFORM");

console.log("test-mctb-capabilities-resolver: PASS");
