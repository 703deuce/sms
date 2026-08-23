/**
 * Prep cert workspace for MCTB demo UI: membership, verified phone, demo step.
 */
import { getPrisma } from "../src/lib/db.ts";
import { saveMctbOnboardingState, loadMctbOnboardingState } from "../src/lib/mctb/onboarding/state.ts";

const WORKSPACE_ID = "cmt3m55zl0p2f5o1l16604i73";
const OWNER_USER_ID = "cmt3m55dw4h250z2p044l0431";
const phone = (process.env.OUTBOUND_TEST_PHONE || process.env.CERT_CONTACT_PHONE || "").trim();

if (!phone) {
  console.error("OUTBOUND_TEST_PHONE or CERT_CONTACT_PHONE required");
  process.exit(1);
}

const prisma = getPrisma();

const existingMem = await prisma.membership.findFirst({
  where: { userId: OWNER_USER_ID, workspaceId: WORKSPACE_ID },
});
if (!existingMem) {
  await prisma.membership.create({
    data: { userId: OWNER_USER_ID, workspaceId: WORKSPACE_ID, role: "OWNER" },
  });
  console.log("created membership");
} else {
  console.log("membership exists");
}

const user = await prisma.user.update({
  where: { id: OWNER_USER_ID },
  data: { phone, phoneVerifiedAt: new Date() },
  select: { email: true, phone: true, phoneVerifiedAt: true },
});
console.log("user phone set", { email: user.email, phone: user.phone });

const state = await loadMctbOnboardingState(WORKSPACE_ID);
await saveMctbOnboardingState(WORKSPACE_ID, {
  currentStep: "demo",
  demoSession: null,
});
const after = await loadMctbOnboardingState(WORKSPACE_ID);
console.log(
  JSON.stringify(
    {
      currentStep: after.currentStep,
      consentMode: after.consentMode,
      completedSteps: after.completedSteps,
    },
    null,
    2,
  ),
);
