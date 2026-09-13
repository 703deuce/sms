import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { PaymentRequestCreateInput } from "@/lib/payment-requests/service";
import { isLeadRecoveryE2eMode } from "@/lib/mctb/lead-recovery/testing/recording/e2e-mode";

export type RecordingPaymentBehavior = "success" | "stripe_fail" | "disconnected" | "timeout";

export type RecordedPaymentCall = {
  kind: "create";
  idempotencyKey?: string;
  amountMinor: number;
  timestamp: string;
};

const ledger: RecordedPaymentCall[] = [];
const memoryRequests = new Map<string, { amountMinor: number; idempotencyKey?: string }>();
let behavior: RecordingPaymentBehavior = "success";

function useInMemoryPaymentStore(): boolean {
  const prisma = getPrisma();
  return !prisma.paymentRequest?.create;
}

export function resetRecordingPaymentLedger() {
  ledger.length = 0;
  memoryRequests.clear();
  behavior = "success";
}

export function getRecordingPaymentLedger(): readonly RecordedPaymentCall[] {
  return ledger;
}

export function setRecordingPaymentBehavior(b: RecordingPaymentBehavior) {
  behavior = b;
}

export function isRecordingPaymentMode(): boolean {
  return isLeadRecoveryE2eMode();
}

function publicToken(): string {
  return `cert_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Recording path for createAndSendPaymentRequest — real DB row, no Stripe. */
export async function recordingCreateAndSendPaymentRequest(input: PaymentRequestCreateInput) {
  if (behavior === "stripe_fail" || behavior === "disconnected" || behavior === "timeout") {
    ledger.push({
      kind: "create",
      idempotencyKey: input.idempotencyKey,
      amountMinor: input.amountMinor,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`LR_E2E: payment ${behavior}`);
  }

  const phone = normalizeE164(input.customerPhoneE164);

  if (input.idempotencyKey && memoryRequests.has(input.idempotencyKey)) {
    return { request: { id: input.idempotencyKey }, replay: true as const };
  }

  ledger.push({
    kind: "create",
    idempotencyKey: input.idempotencyKey,
    amountMinor: input.amountMinor,
    timestamp: new Date().toISOString(),
  });

  if (process.env.LR_CERT_E2E === "1" || useInMemoryPaymentStore()) {
    if (input.idempotencyKey) {
      memoryRequests.set(input.idempotencyKey, {
        amountMinor: input.amountMinor,
        idempotencyKey: input.idempotencyKey,
      });
    }
    const token = publicToken();
    const { sendQuickSms } = await import("@/lib/sms/send-quick");
    const publicUrl = `https://pay.example.test/${token}`;
    try {
      await sendQuickSms({
        workspaceId: input.workspaceId,
        to: phone,
        body: `Pay ${(input.amountMinor / 100).toFixed(2)}: ${publicUrl}`,
        idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:sms` : undefined,
        demoBypass: true,
      });
    } catch {
      return {
        request: { id: token, amountMinor: input.amountMinor },
        replay: false as const,
        smsFailed: true as const,
      };
    }
    return { request: { id: token, amountMinor: input.amountMinor }, replay: false as const };
  }

  const prisma = getPrisma();
  if (input.idempotencyKey) {
    const existing = await prisma.paymentRequest.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { request: existing, replay: true as const };
    }
  }

  const token = publicToken();
  const row = await prisma.paymentRequest.create({
    data: {
      workspaceId: input.workspaceId,
      processor: "STRIPE",
      customerPhoneE164: phone,
      amountMinor: input.amountMinor,
      currency: (input.currency || "usd").toLowerCase(),
      description: input.description.trim(),
      customerName: input.customerName?.trim() || null,
      contactId: input.contactId || null,
      conversationId: input.conversationId || null,
      idempotencyKey: input.idempotencyKey || null,
      publicToken: token,
      status: "ready",
      collectionMethod: "checkout",
      processorCheckoutId: `cert_chk_${token}`,
    },
  });

  if (input.sendSms === false) {
    return { request: row, replay: false as const };
  }

  const { sendQuickSms } = await import("@/lib/sms/send-quick");
  const publicUrl = `https://pay.example.test/${token}`;
  const smsResult = await sendQuickSms({
    workspaceId: input.workspaceId,
    to: phone,
    body: `Pay ${(input.amountMinor / 100).toFixed(2)}: ${publicUrl}`,
    idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:sms` : undefined,
    demoBypass: true,
  }).catch((err) => ({ error: err instanceof Error ? err.message : String(err) }));

  if (smsResult && "error" in smsResult) {
    return { request: row, replay: false as const, smsFailed: true as const };
  }

  return { request: row, replay: false as const };
}
