import assert from "node:assert/strict";
import {
  currentMctbRecoveryPeriodKey,
  mctbRecoveryPeriodUtcBounds,
  MCTB_AI_RECOVERY_MONTHLY_RECOVERY_LIMIT,
  MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
  MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT,
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
  10,
);
assert.equal(
  resolveMctbMonthlyRecoveryLimit({
    mctbProductActive: true,
    recoveryPaid: true,
    paidTier: "starter",
  }),
  MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT,
);
assert.equal(
  resolveMctbMonthlyRecoveryLimit({
    mctbProductActive: true,
    recoveryPaid: true,
    paidTier: null,
  }),
  MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT,
);
assert.equal(
  resolveMctbMonthlyRecoveryLimit({
    mctbProductActive: true,
    recoveryPaid: false,
    aiRecoveryEntitled: true,
    paidTier: null,
  }),
  MCTB_AI_RECOVERY_MONTHLY_RECOVERY_LIMIT,
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
