import { sendQuickSms } from "@/lib/sms/send-quick";
import { messagingOnboarding } from "@/lib/messaging/service";
import { isLiveMessagingAdapter } from "@/lib/messaging/twilio-config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type SendSmsInput = {
  to: string;
  from: string;
  body: string;
  mediaUrl?: string;
  workspaceId?: string;
};

export type SendSmsResult = {
  id: string;
  status: "queued" | "sent" | "failed";
  provider: "stub" | "twilio";
  error?: string;
};

export interface SmsProvider {
  send(input: SendSmsInput): Promise<SendSmsResult>;
  buyNumber(areaCode: string, workspaceId?: string): Promise<{ e164: string; sid: string }>;
  registerBrand(payload: Record<string, unknown>): Promise<{ status: string; id: string }>;
}

export class StubSmsProvider implements SmsProvider {
  async send(input: SendSmsInput): Promise<SendSmsResult> {
    if (!input.to || !input.body) {
      return { id: `stub_fail_${Date.now()}`, status: "failed", provider: "stub", error: "Missing to/body" };
    }
    return { id: `stub_${Date.now()}`, status: "queued", provider: "stub" };
  }

  async buyNumber(areaCode: string) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    return { e164: `+1${areaCode}555${suffix}`.slice(0, 12), sid: `PN_stub_${Date.now()}` };
  }

  async registerBrand() {
    return { status: "pending", id: `BR_stub_${Date.now()}` };
  }
}

/**
 * Live/mock ISV path: sends via the workspace Messaging Service once registration is ready.
 * Falls back to stub errors when workspaceId is missing.
 */
export class TwilioIsvSmsProvider implements SmsProvider {
  async send(input: SendSmsInput): Promise<SendSmsResult> {
    if (!input.workspaceId) {
      return {
        id: `twilio_fail_${Date.now()}`,
        status: "failed",
        provider: "twilio",
        error: "workspaceId is required for ISV sends",
      };
    }
    try {
      const result = await sendQuickSms({
        workspaceId: input.workspaceId,
        to: input.to,
        body: input.body,
        from: input.from,
      });
      return {
        id: result.sid,
        status: result.status === "failed" ? "failed" : "queued",
        provider: "twilio",
      };
    } catch (err) {
      return {
        id: `twilio_fail_${Date.now()}`,
        status: "failed",
        provider: "twilio",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async buyNumber(areaCode: string, workspaceId?: string) {
    if (!workspaceId) throw new Error("workspaceId required to buy a number");
    const results = await messagingOnboarding.searchNumbers(workspaceId, areaCode);
    const pick = results[0];
    if (!pick) throw new Error("No numbers available for that area code");
    const reg = await messagingOnboarding.purchaseNumber(workspaceId, pick.phoneNumber);
    return { e164: reg.phoneE164 || pick.phoneNumber, sid: reg.phoneSid || "" };
  }

  async registerBrand() {
    return { status: "use_messaging_registration_api", id: "n/a" };
  }
}

export function getSmsProvider(): SmsProvider {
  if (isLiveMessagingAdapter() || process.env.TWILIO_ACCOUNT_SID) {
    return new TwilioIsvSmsProvider();
  }
  return new StubSmsProvider();
}

export { normalizeE164 };
