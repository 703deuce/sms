#!/usr/bin/env tsx
/**
 * Simulates New UI AI Recovery save: settings patch then scenario-only lead-recovery/config patch.
 */
import { buildAiRecoverySavePatch } from "../src/lib/mctb/ai-recovery/sync-collection-config";
import {
  loadLeadRecoveryConfigPersisted,
  saveLeadRecoveryConfig,
} from "../src/lib/mctb/lead-recovery/config";
import { intentsForEnabledScenarios } from "../src/lib/mctb/lead-recovery/scenarios";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  const resetOnly = process.argv.includes("--reset-callback-off");
  const before = await loadLeadRecoveryConfigPersisted(WORKSPACE_ID);
  if (resetOnly) {
    const patch = buildAiRecoverySavePatch({
      enabled: true,
      fieldToggles: {
        NAME: true,
        REASON: true,
        ADDRESS: true,
        URGENCY: true,
        CALLBACK_TIME: false,
      },
      bookingLinkEnabled: false,
      bookingLinkId: before.bookingLinkId,
      existing: before,
    });
    await saveLeadRecoveryConfig(WORKSPACE_ID, patch);
    await saveLeadRecoveryConfig(WORKSPACE_ID, {
      enabled: true,
      enabledScenarios: before.enabledScenarios,
      enabledIntents: intentsForEnabledScenarios(before.enabledScenarios),
      collectCapabilities: undefined,
    });
    const after = await loadLeadRecoveryConfigPersisted(WORKSPACE_ID);
    console.log("reset-callback-off", after.collectCapabilities);
    return;
  }
  console.log("before", {
    enabled: before.enabled,
    caps: before.collectCapabilities,
  });

  const patch = buildAiRecoverySavePatch({
    enabled: true,
    fieldToggles: {
      NAME: true,
      REASON: true,
      ADDRESS: true,
      URGENCY: true,
      CALLBACK_TIME: true,
    },
    bookingLinkEnabled: false,
    bookingLinkId: before.bookingLinkId,
    existing: before,
  });
  await saveLeadRecoveryConfig(WORKSPACE_ID, patch);
  const mid = await loadLeadRecoveryConfigPersisted(WORKSPACE_ID);
  console.log("after settings-equivalent save", { caps: mid.collectCapabilities });

  await saveLeadRecoveryConfig(WORKSPACE_ID, {
    enabled: true,
    enabledScenarios: mid.enabledScenarios,
    enabledIntents: intentsForEnabledScenarios(mid.enabledScenarios),
    collectCapabilities: undefined,
    intentPolicies: undefined,
  });
  const after = await loadLeadRecoveryConfigPersisted(WORKSPACE_ID);
  const hasCallback =
    after.collectCapabilities.includes("CALLBACK_TIME") ||
    after.collectCapabilities.includes("CALLBACK_NUMBER");
  console.log("after scenario-only save", { caps: after.collectCapabilities, hasCallback });
  if (!hasCallback) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
