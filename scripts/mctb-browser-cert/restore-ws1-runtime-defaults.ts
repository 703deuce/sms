/**
 * Restore ws_1 recovery timing fields after a partial UI cert run (ops only).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-browser-cert/restore-ws1-runtime-defaults.ts
 */
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { saveMctbOnboardingState } from "@/lib/mctb/onboarding/state";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";

async function main() {
  await updateMissedCallTextConfig({
    workspaceId: WORKSPACE_ID,
    patch: {
      cooldown_minutes: 1440,
      max_messages_per_caller: 3,
      delay_seconds: 30,
      trigger_rules: {
        no_answer: true,
        busy: true,
        rejected: true,
        timeout: true,
        voicemail: false,
      },
    },
    source: "mctb_ui_cert_restore",
  });
  await saveMctbOnboardingState(WORKSPACE_ID, { forwardingRingSeconds: 15 });
  console.log("restored ws_1 recovery defaults");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
