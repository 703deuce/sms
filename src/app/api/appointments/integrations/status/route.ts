import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const googleCalendarConfigured = Boolean(
      process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim(),
    );
    const openAiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
    const brevoConfigured = Boolean(process.env.BREVO_API_KEY?.trim());

    return NextResponse.json({
      data: {
        googleCalendarConfigured,
        openAiConfigured,
        brevoConfigured,
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
