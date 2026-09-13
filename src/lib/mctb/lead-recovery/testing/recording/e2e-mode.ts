/**
 * Lead Recovery E2E certification — recording provider mode (no live SMS/Stripe/calendars).
 */
export function isLeadRecoveryE2eMode(): boolean {
  return (
    process.env.LR_CERT_E2E === "1" ||
    process.env.LR_CERT_FULL_E2E === "1" ||
    process.env.HEADLESS_PROVIDER_MODE === "recording"
  );
}

import { clearRecordingSmsOutbox } from "@/lib/voice/testing/headless/recording-sms";
import { resetRecordingPaymentLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-payment";
import { resetRecordingBookingLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-booking";
import { resetRecordingHandoffLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-handoff";

export function resetLeadRecoveryE2eRecording(): void {
  clearRecordingSmsOutbox();
  resetRecordingPaymentLedger();
  resetRecordingBookingLedger();
  resetRecordingHandoffLedger();
}
