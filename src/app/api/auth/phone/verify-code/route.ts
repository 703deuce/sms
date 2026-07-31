import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  PHONE_OTP_COOKIE,
  PHONE_VERIFIED_COOKIE,
  createVerifiedToken,
  normalizePhone,
  verifyOtpToken,
} from "@/lib/auth/phone-otp";

/** Verifies the one-time code against the signed cookie set by send-code. */
export async function POST(request: Request) {
  let phone: string;
  let code: string;
  try {
    const body = (await request.json()) as { phone?: string; code?: string };
    if (!body.phone || !body.code) {
      return NextResponse.json({ error: "Phone and code are required." }, { status: 400 });
    }
    phone = normalizePhone(body.phone);
    code = body.code.replace(/\D/g, "");
  } catch {
    return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }

  const store = await cookies();
  const token = store.get(PHONE_OTP_COOKIE)?.value;
  const result = verifyOtpToken(token, phone, code);
  if (!result.ok) {
    const message =
      result.reason === "expired"
        ? "That code expired. Request a new one."
        : "That code is not correct. Please try again.";
    return NextResponse.json({ error: message, reason: result.reason }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, verified: true, phone });
  res.cookies.set(PHONE_VERIFIED_COOKIE, createVerifiedToken(phone), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set(PHONE_OTP_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
