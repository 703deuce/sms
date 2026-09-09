import {
  listLoyaltyPrograms,
  upsertLoyaltyProgram,
  getLoyaltyBalance,
  earnLoyaltyPoints,
  redeemLoyaltyPoints,
  listLoyaltyLedger,
  getOrCreateReferralCode,
  configureReferralRewards,
} from "@/lib/appointments/service-booking/phase2";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const programId = url.searchParams.get("programId");
  const contactId = url.searchParams.get("contactId");

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (programId && contactId) {
      if (url.searchParams.get("ledger") === "1") {
        return listLoyaltyLedger(workspaceId, programId, contactId);
      }
      return getLoyaltyBalance(workspaceId, programId, contactId);
    }
    return listLoyaltyPrograms(workspaceId);
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    switch (body.action) {
      case "earn":
        return earnLoyaltyPoints(workspaceId, body.programId, body.contactId, body);
      case "redeem":
        return redeemLoyaltyPoints(
          workspaceId,
          body.programId,
          body.contactId,
          body.points,
          body,
        );
      case "referral_code":
        return getOrCreateReferralCode(workspaceId, body.programId, body.contactId);
      case "configure_referrals":
        return configureReferralRewards(workspaceId, body.programId, body);
      default:
        return upsertLoyaltyProgram(workspaceId, body);
    }
  });
}
