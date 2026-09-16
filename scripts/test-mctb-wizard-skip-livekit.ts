/**
 * Assert appointment-receptionist wizard publish skips LiveKit and uses TeXML path.
 *   npx tsx scripts/test-mctb-wizard-skip-livekit.ts
 */
import assert from "node:assert/strict";
import { shouldSkipLiveKitProvisionForMctbPhone } from "../src/lib/mctb/sip-ingress/sync";

assert.equal(
  shouldSkipLiveKitProvisionForMctbPhone({}, { appointmentWizard: true }),
  true,
  "appointment wizard must skip LiveKit even on a plain phone row",
);

assert.equal(
  shouldSkipLiveKitProvisionForMctbPhone(
    { telephony: { routingMode: "mctb_texml" } },
    { appointmentWizard: false },
  ),
  true,
  "MCTB TeXML ingress must skip LiveKit",
);

assert.equal(
  shouldSkipLiveKitProvisionForMctbPhone({}, { appointmentWizard: false }),
  false,
  "generic voice line without MCTB markers should not skip LiveKit",
);

console.log("ok test-mctb-wizard-skip-livekit");
