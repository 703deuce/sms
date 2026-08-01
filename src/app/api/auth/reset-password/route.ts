import { hash } from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  PHONE_VERIFIED_COOKIE,
  normalizePhone,
  readVerifiedPhone,
} from "@/lib/auth/phone-otp";
import { getPrisma } from "@/lib/db";

/**
 * Password recovery via SMS OTP.
 * Requires a recently verified phone cookie from /api/auth/phone/verify-code
 * for the same mobile number submitted with the account email.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      phone?: string;
      password?: string;
    };
    if (!body.email || !body.phone || !body.password) {
      return NextResponse.json(
        { error: "Email, mobile number, and new password are required." },
        { status: 400 },
      );
    }
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const email = body.email.trim().toLowerCase();
    const phone = normalizePhone(body.phone);
    const store = await cookies();
    const verified = readVerifiedPhone(store.get(PHONE_VERIFIED_COOKIE)?.value, 30 * 60 * 1000);
    if (!verified || verified !== phone) {
      return NextResponse.json(
        { error: "Verify your mobile number with an SMS code before resetting your password." },
        { status: 400 },
      );
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Same generic response to avoid account enumeration.
      return NextResponse.json({ ok: true });
    }

    if (user.phone && user.phone !== phone) {
      return NextResponse.json(
        { error: "That mobile number does not match this account." },
        { status: 400 },
      );
    }

    const passwordHash = await hash(body.password, 10);
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          phone,
          phoneVerifiedAt: new Date(),
        },
      });
    } catch (err) {
      console.warn("[auth/reset-password] phone fields unavailable, password-only update", err);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/reset-password]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to reset password." },
      { status: 500 },
    );
  }
}
