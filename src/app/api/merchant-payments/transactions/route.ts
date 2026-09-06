import { NextResponse } from "next/server";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { listMerchantPaymentTransactions } from "@/lib/merchant-payments/transactions";

export async function GET() {
  const auth = await requireAppointmentsAccess("appointments.read");
  if ("error" in auth) return auth.error;

  const transactions = await listMerchantPaymentTransactions(auth.workspaceId);
  return NextResponse.json({ data: { transactions } });
}
