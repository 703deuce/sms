import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import {
  claimGuestPremiumReservation,
  GUEST_RESERVATION_COOKIE,
} from "@/lib/premium-numbers/reservation-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const url = new URL(request.url);
  const workspaceIdParam = url.searchParams.get("workspaceId");

  try {
    const workspaceId = await resolveWorkspaceId(auth.session, workspaceIdParam);
    const cookieStore = await cookies();
    const guestCookie = cookieStore.get(GUEST_RESERVATION_COOKIE)?.value ?? null;

    const result = await claimGuestPremiumReservation({
      reservationId: id,
      targetWorkspaceId: workspaceId,
      targetUserId: auth.session.userId,
      guestCookieReservationId: guestCookie,
    });

    if (!result.ok) {
      const status =
        result.status === "not_found"
          ? 404
          : result.status === "forbidden"
            ? 403
            : result.status === "expired"
              ? 409
              : 400;
      return NextResponse.json({ error: result.error, status: result.status }, { status });
    }

    const res = NextResponse.json(result);
    res.cookies.set(GUEST_RESERVATION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return res;
  } catch (err) {
    return jsonError(err, 400);
  }
}
