import { NextResponse } from "next/server";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { listMerchantPaymentTransactions } from "@/lib/merchant-payments/transactions";

export async function GET(request: Request) {
  const auth = await requireAppointmentsAccess("appointments.read");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const transactions = await listMerchantPaymentTransactions(auth.workspaceId, {
    limit: Math.min(200, Number(searchParams.get("limit") || 100)),
    status: searchParams.get("status") || undefined,
    provider: searchParams.get("provider") || undefined,
    query: searchParams.get("q") || undefined,
  });
  return NextResponse.json({ data: { transactions } });
}
