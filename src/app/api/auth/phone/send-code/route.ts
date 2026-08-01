import { NextResponse } from "next/server";
import {
  PHONE_OTP_COOKIE,
  OTP_TTL_SECONDS,
  createOtpToken,
  generateCode,
  normalizePhone,
} from "@/lib/auth/phone-otp";
import { smsOtpMessage } from "@/lib/auth/sms-opt-in-copy";
import { getTelnyxApiBaseUrl, getTelnyxApiKey } from "@/lib/messaging/telnyx/config";

/**
 * Sends a one-time SMS verification code (opt-in step).
 * The code itself is never returned to the client — only stored as an
 * HMAC-signed httpOnly cookie for later verification.
 */
export async function POST(request: Request) {
  let phone: string;
  try {
    const body = (await request.json()) as { phone?: string; consent?: boolean };
    if (!body.consent) {
      return NextResponse.json(
        { error: "You must agree to receive SMS to continue." },
        { status: 400 },
      );
    }
    if (!body.phone) {
      return NextResponse.json({ error: "Mobile number is required." }, { status: 400 });
    }
    phone = normalizePhone(body.phone);
  } catch {
    return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }

  const code = generateCode();
  const token = createOtpToken(phone, code);

  let delivered = false;
  const from = process.env.TELNYX_VERIFY_FROM?.trim();
  const apiKey = getTelnyxApiKey();
  if (apiKey && from) {
    try {
      const res = await fetch(`${getTelnyxApiBaseUrl()}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: phone,
          text: smsOtpMessage(code),
        }),
      });
      delivered = res.ok;
      if (!res.ok) {
        console.warn("[phone/send-code] Telnyx send failed", res.status, await res.text());
      }
    } catch (err) {
      console.warn("[phone/send-code] Telnyx send error", err);
    }
  }

  if (!delivered && process.env.NODE_ENV !== "production") {
    // Dev fallback: no platform sending number configured yet.
    console.log(`[phone/send-code] DEV verification code for ${phone}: ${code}`);
  }

  const res = NextResponse.json({ ok: true, delivered, expiresInSeconds: OTP_TTL_SECONDS });
  res.cookies.set(PHONE_OTP_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: OTP_TTL_SECONDS,
  });
  return res;
}
