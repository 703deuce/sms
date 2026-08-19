import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { invalidatePopularShelfNumber } from "@/lib/premium-numbers/popular-inventory";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { getPublicLandingSearchContext } from "@/lib/premium-numbers/public-landing-context";
import { reservePremiumNumber } from "@/lib/premium-numbers/reservation-service";
import type { PremiumSearchMode } from "@/lib/premium-numbers/premium-pricing";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    phoneNumber?: string;
    searchLogId?: string;
    searchMode?: PremiumSearchMode;
  } | null;

  const phoneNumber = String(body?.phoneNumber || "").trim();
  const searchLogId = String(body?.searchLogId || "").trim();
  if (!phoneNumber || !searchLogId) {
    return NextResponse.json({ error: "phoneNumber and searchLogId required" }, { status: 400 });
  }

  try {
    const ctx = await getPublicLandingSearchContext();
    trackNumbersLandingEvent("number_reserve_clicked", { phoneNumber });

    const result = await reservePremiumNumber({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      phoneNumber,
      searchLogId,
      searchMode: body?.searchMode === "business" ? "business" : "personal",
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 409 });
    }

    invalidatePopularShelfNumber(phoneNumber);
    trackNumbersLandingEvent("reservation_created", {
      phoneNumber,
      reservationId: result.reservationId ?? "",
    });

    const cookieStore = await cookies();
    cookieStore.set("transovo_guest_reservation", result.reservationId ?? "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 30,
      path: "/",
    });

    return NextResponse.json({
      ...result,
      requiresAuth: true,
      signupUrl: `/signup?next=${encodeURIComponent(`/personal/numbers/premium?reservation=${result.reservationId}`)}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reservation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
