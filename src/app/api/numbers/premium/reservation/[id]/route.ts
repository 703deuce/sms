import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { getPremiumReservation } from "@/lib/premium-numbers/reservation-service";

export async function GET(
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
    const row = await getPremiumReservation(workspaceId, id);
    if (!row) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      phoneNumber: row.phoneNumber,
      vanityDisplay: row.vanityDisplay,
      displayNumber: row.displayNumber,
      premiumPriceCents: row.premiumPriceCents,
      reservationStatus: row.reservationStatus,
      reservationExpiresAt: row.reservationExpiresAt?.toISOString(),
      paymentStatus: row.paymentStatus,
      orderStatus: row.orderStatus,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
