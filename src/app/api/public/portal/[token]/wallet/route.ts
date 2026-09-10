import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveClientPortalSession } from "@/lib/appointments/service-booking";
import {
  getWalletBalance,
  listWalletLedger,
} from "@/lib/appointments/service-booking/phase2/client-wallet";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveClientPortalSession(token);
    if (!resolved) return NextResponse.json({ error: "Invalid or expired portal session" }, { status: 404 });

    const [wallet, ledger] = await Promise.all([
      getWalletBalance(resolved.session.workspaceId, resolved.session.contactId),
      listWalletLedger(resolved.session.workspaceId, resolved.session.contactId, 30),
    ]);
    return NextResponse.json({
      data: {
        ...wallet,
        history: ledger.map((e: (typeof ledger)[number]) => ({
          id: e.id,
          date: e.createdAt.toISOString(),
          activity: e.note || e.kind,
          amountCents: e.amountCents,
          balanceCents: e.balanceAfterCents,
        })),
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
