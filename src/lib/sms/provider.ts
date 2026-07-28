export type SendSmsInput = {
  to: string;
  from: string;
  body: string;
  mediaUrl?: string;
};

export type SendSmsResult = {
  id: string;
  status: "queued" | "sent" | "failed";
  provider: "stub" | "twilio";
  error?: string;
};

export interface SmsProvider {
  send(input: SendSmsInput): Promise<SendSmsResult>;
  buyNumber(areaCode: string): Promise<{ e164: string; sid: string }>;
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

/** Twilio adapter placeholder — wire when TWILIO_* env vars are present. */
export class TwilioSmsProvider implements SmsProvider {
  async send(): Promise<SendSmsResult> {
    throw new Error("Twilio provider not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
  }
  async buyNumber(): Promise<{ e164: string; sid: string }> {
    throw new Error("Twilio provider not configured.");
  }
  async registerBrand(): Promise<{ status: string; id: string }> {
    throw new Error("Twilio provider not configured.");
  }
}

export function getSmsProvider(): SmsProvider {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return new TwilioSmsProvider();
  }
  return new StubSmsProvider();
}
