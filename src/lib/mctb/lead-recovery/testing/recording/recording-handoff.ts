import type { MctbHandoffEventType, MctbLeadSnapshotDerived, MctbLeadSnapshotFacts } from "@/lib/mctb/handoff/types";
import { isLeadRecoveryE2eMode } from "@/lib/mctb/lead-recovery/testing/recording/e2e-mode";

export type RecordedHandoffNotification = {
  workspaceId: string;
  eventType: MctbHandoffEventType;
  handoffEventId: string;
  timestamp: string;
  fail?: boolean;
};

const ledger: RecordedHandoffNotification[] = [];
let nextFail = false;

export function resetRecordingHandoffLedger() {
  ledger.length = 0;
  nextFail = false;
}

export function getRecordingHandoffLedger(): readonly RecordedHandoffNotification[] {
  return ledger;
}

export function setRecordingHandoffNextFail(fail: boolean) {
  nextFail = fail;
}

export function isRecordingHandoffMode(): boolean {
  return isLeadRecoveryE2eMode();
}

export async function deliverRecordingHandoffNotifications(input: {
  workspaceId: string;
  handoffEventId: string;
  eventType: MctbHandoffEventType;
  urgent?: boolean;
  facts: MctbLeadSnapshotFacts;
  derived?: MctbLeadSnapshotDerived;
  conversationId?: string | null;
  missedCallEventId?: string | null;
}): Promise<void> {
  if (nextFail) {
    ledger.push({
      workspaceId: input.workspaceId,
      eventType: input.eventType,
      handoffEventId: input.handoffEventId,
      timestamp: new Date().toISOString(),
      fail: true,
    });
    throw new Error("LR_E2E: handoff notification injected failure");
  }
  ledger.push({
    workspaceId: input.workspaceId,
    eventType: input.eventType,
    handoffEventId: input.handoffEventId,
    timestamp: new Date().toISOString(),
  });
}
