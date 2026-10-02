/**
 * Apply CERT_BASELINE_JSON to workspace (server-side restore after UI cert).
 */
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { saveMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import type { CertWorkspaceBaseline } from "./ui-persistence-helpers";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const raw = process.env.CERT_BASELINE_JSON;
if (!raw) {
  console.error("CERT_BASELINE_JSON missing");
  process.exit(1);
}
const baseline = JSON.parse(raw) as CertWorkspaceBaseline;

async function main() {
  const r = baseline.runtime;
  await updateMissedCallTextConfig({
    workspaceId: WORKSPACE_ID,
    patch: {
      delay_seconds: Number(r.delaySeconds ?? 30),
      cooldown_minutes: Number(r.cooldownMinutes ?? 1440),
      max_messages_per_caller: Number(r.maxMessagesPerCaller ?? 3),
      initial_message: typeof r.messageTemplate === "string" ? r.messageTemplate : undefined,
      trigger_rules: {
        no_answer: Boolean(r.sendAfterNoAnswer),
        busy: Boolean(r.sendAfterBusy),
        rejected: Boolean(r.sendAfterRejected),
        timeout: Boolean(r.sendAfterTimeout),
        voicemail: Boolean(r.sendAfterVoicemail),
      },
    },
    source: "mctb_ui_cert_baseline_restore",
  });
  const ring = baseline.onboarding.forwardingRingSeconds;
  if (ring != null) {
    await saveMctbOnboardingState(WORKSPACE_ID, {
      forwardingRingSeconds: Number(ring),
      forwardingCarrier: baseline.onboarding.forwardingCarrier as never,
    });
  }
  console.log("baseline applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
