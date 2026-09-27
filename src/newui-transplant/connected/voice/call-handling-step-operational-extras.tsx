"use client";

import {
  VoiceCallHandlingRecentTransfersPanel,
  VoiceCallHandlingRoutingPanel,
} from "./call-handling-operations-panels";

/**
 * Operational surfaces from /voice/call-handling that Step 5 does not duplicate as configuration.
 * Rendered inline below the canonical Call Handling editor (no secondary nav).
 */
export function CallHandlingStepOperationalExtras() {
  return (
    <div className="space-y-8 border-t border-border pt-8">
      <VoiceCallHandlingRecentTransfersPanel />
      <VoiceCallHandlingRoutingPanel />
    </div>
  );
}
