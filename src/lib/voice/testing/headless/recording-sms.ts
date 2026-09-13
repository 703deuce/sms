/**
 * Test adapter below sendQuickSms — records logical SMS without Telnyx/provider I/O.
 * Enable with HEADLESS_PROVIDER_MODE=recording or VOICE_HEADLESS_SMS_MODE=recording.
 */

import type { QuickSendSmsInput } from "@/lib/sms/send-quick";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type RecordedSms = {
  workspaceId: string;
  to: string;
  from: string;
  body: string;
  idempotencyKey?: string;
  timestamp: string;
  messageId: string;
  status: "sent";
};

const outbox: RecordedSms[] = [];
const idempotencyIndex = new Map<string, string>();

export function clearRecordingSmsOutbox(): void {
  outbox.length = 0;
  idempotencyIndex.clear();
}

export function getRecordingSmsOutbox(): readonly RecordedSms[] {
  return outbox;
}

export function isRecordingSmsMode(): boolean {
  const mode = (
    process.env.HEADLESS_PROVIDER_MODE ||
    process.env.VOICE_HEADLESS_SMS_MODE ||
    ""
  ).trim().toLowerCase();
  return mode === "recording" || mode === "record";
}

export async function deliverRecordingSms(
  input: QuickSendSmsInput,
): Promise<{ sid: string; status: string; trackingToken?: string }> {
  const to = normalizeE164(input.to);
  const from = normalizeE164(input.from || "+15714073615") || "+15714073615";
  const key = input.idempotencyKey?.trim();
  if (key && idempotencyIndex.has(key)) {
    const priorId = idempotencyIndex.get(key)!;
    return { sid: priorId, status: "sent" };
  }

  const messageId = `test_sms_${outbox.length + 1}_${Date.now().toString(36)}`;
  const row: RecordedSms = {
    workspaceId: input.workspaceId,
    to,
    from,
    body: input.body,
    idempotencyKey: key,
    timestamp: new Date().toISOString(),
    messageId,
    status: "sent",
  };
  outbox.push(row);
  if (key) idempotencyIndex.set(key, messageId);
  return { sid: messageId, status: "sent" };
}
