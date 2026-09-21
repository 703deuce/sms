import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

export type VoiceV3PublishQualityIssue = {
  code: string;
  message: string;
  blocking: boolean;
};

export function validateVoiceV3WizardPublishQuality(
  state: AppointmentReceptionistWizardState,
): VoiceV3PublishQualityIssue[] {
  const issues: VoiceV3PublishQualityIssue[] = [];
  const blockers = state.qualityStudioLastRun?.publishBlockers ?? [];

  for (const b of blockers) {
    issues.push({
      code: "QUALITY_STUDIO_BLOCKER",
      message: String(b),
      blocking: true,
    });
  }

  if (state.lastTestPassed === false) {
    issues.push({
      code: "WIZARD_TEST_FAILED",
      message: "Latest wizard test did not pass.",
      blocking: process.env.VOICE_V3_PUBLISH_REQUIRE_TEST_PASS === "1",
    });
  }

  if (
    process.env.VOICE_V3_PUBLISH_REQUIRE_TEST_PASS === "1" &&
    state.lastTestPassed !== true
  ) {
    issues.push({
      code: "WIZARD_TEST_NOT_PASSED",
      message: "A passing wizard test is required before publish.",
      blocking: true,
    });
  }

  return issues;
}

export function hasBlockingVoiceV3PublishQualityIssues(
  issues: VoiceV3PublishQualityIssue[],
): boolean {
  return issues.some((i) => i.blocking);
}
