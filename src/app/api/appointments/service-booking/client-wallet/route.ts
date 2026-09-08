import {
  getWalletBalance,
  creditWallet,
  debitWallet,
  listWalletLedger,
} from "@/lib/appointments/service-booking/phase2";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const contactId = new URL(request.url).searchParams.get("contactId");
  if (!contactId) {
    return withAppointmentsAuth("appointments.read", async () => {
      throw new Error("contactId is required");
    });
  }

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const ledger = new URL(request.url).searchParams.get("ledger") === "1";
    if (ledger) {
      return listWalletLedger(workspaceId, contactId);
    }
    return getWalletBalance(workspaceId, contactId);
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    switch (body.action) {
      case "credit":
        return creditWallet(workspaceId, body.contactId, body.amountCents, body);
      case "debit":
        return debitWallet(workspaceId, body.contactId, body.amountCents, body);
      default:
        throw new Error("action must be credit or debit");
    }
  });
}
