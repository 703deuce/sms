/**
 * Free plan may use Press-1 or Existing Consent; attestation still required for existing_consent.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-free-existing-consent-gates.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isExistingConsentModeEligible } from "../src/lib/mctb/setup-consent-eligibility";
import { MCTB_CONSENT_MODE_EXISTING, MCTB_CONSENT_MODE_VERIFIED } from "../src/lib/mctb/consent-mode";
import { validateExistingConsentAttestation } from "../src/lib/mctb/capture/attestation";
import { resolveMctbMonthlyRecoveryLimit } from "../src/lib/mctb/recovery-usage-constants";
import { MCTB_FREE_MONTHLY_RECOVERY_LIMIT } from "../src/lib/mctb/recovery-usage-constants";

// --- UI eligibility (no paid gate) ---
assert.equal(
  isExistingConsentModeEligible({
    platformSenderActive: true,
    messagingReady: false,
    mctbProductActive: true,
  }),
  true,
  "free + platform sender → existing consent mode eligible",
);

assert.equal(
  isExistingConsentModeEligible({
    platformSenderActive: false,
    messagingReady: false,
    mctbProductActive: false,
  }),
  false,
);

// Press-1 does not require existing-consent eligibility helper (mode is always available when MCTB active).
assert.ok(MCTB_CONSENT_MODE_VERIFIED === "press_1");
assert.ok(MCTB_CONSENT_MODE_EXISTING === "existing_consent");

// Same free allowance regardless of consent mode (resolver has no consent parameter).
const freeLimit = resolveMctbMonthlyRecoveryLimit({
  mctbProductActive: true,
  recoveryPaid: false,
  aiRecoveryEntitled: false,
  paidTier: null,
});
assert.equal(freeLimit, MCTB_FREE_MONTHLY_RECOVERY_LIMIT);

async function runDbAttestationProof(): Promise<void> {
const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.log("test-mctb-free-existing-consent-gates: PASS (static); DB attestation skipped");
  return;
}

const { getPrisma } = await import("../src/lib/db");
const prisma = getPrisma();
const workspaceId = `mctb_free_ec_${randomUUID().slice(0, 8)}`;

await prisma.workspace.create({
  data: {
    id: workspaceId,
    name: "Free existing consent gate test",
    slug: `mctb-free-ec-${randomUUID().slice(0, 8)}`,
    type: "BUSINESS",
    billingPlan: "trial",
    customFieldsConfig: {
      mctb: { consentMode: MCTB_CONSENT_MODE_EXISTING },
    },
  },
});

try {
  const missingAttestation = await validateExistingConsentAttestation(workspaceId);
  assert.equal(missingAttestation.existingConsentValid, false);
  assert.notEqual(missingAttestation.reason, "EXISTING_CONSENT_REQUIRES_PAID_PLAN");
  assert.ok(
    missingAttestation.reason === "MISSING_ATTESTATION" ||
      missingAttestation.reason === "ATTESTATION_NOT_ACCEPTED" ||
      missingAttestation.reason?.includes("ATTESTATION"),
    `expected attestation reason, got ${missingAttestation.reason}`,
  );

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customFieldsConfig: {
        mctb: {
          consentMode: MCTB_CONSENT_MODE_EXISTING,
          onboarding: {
            consentMode: MCTB_CONSENT_MODE_EXISTING,
            completedSteps: ["consent"],
          },
        },
      },
    },
  });

  const valid = await validateExistingConsentAttestation(workspaceId);
  assert.equal(valid.existingConsentValid, true, "free + completed consent onboarding → valid");
  assert.notEqual(valid.reason, "EXISTING_CONSENT_REQUIRES_PAID_PLAN");
} finally {
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
}
}

runDbAttestationProof()
  .then(() => console.log("test-mctb-free-existing-consent-gates: PASS"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
