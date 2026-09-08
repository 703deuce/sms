import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveClientPortalSession } from "@/lib/appointments/service-booking";
import { getWalletBalance } from "@/lib/appointments/service-booking/phase2/client-wallet";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveClientPortalSession(token);
    if (!resolved) return NextResponse.json({ error: "Invalid or expired portal session" }, { status: 404 });

    const wallet = await getWalletBalance(resolved.session.workspaceId, resolved.session.contactId);
    return NextResponse.json({ data: wallet });
  } catch (err) {
    return jsonError(err, 400);
  }
}
