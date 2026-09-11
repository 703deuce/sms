import {
  createPosSession,
  getPosSession,
  listOpenPosSessions,
  addPosLineItem,
  removePosLineItem,
  checkoutPosSession,
  voidPosSession,
} from "@/lib/appointments/service-booking/phase2";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (sessionId) return getPosSession(workspaceId, sessionId);
    return listOpenPosSessions(workspaceId);
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId, userId }) => {
    switch (body.action) {
      case "create":
        return createPosSession(workspaceId, {
          contactId: body.contactId,
          staffUserId: body.staffUserId ?? userId,
          metadata: body.metadata,
        });
      case "add_line":
        return addPosLineItem(workspaceId, body.sessionId, body.line);
      case "remove_line":
        return removePosLineItem(workspaceId, body.sessionId, body.lineItemId);
      case "checkout":
        return checkoutPosSession(workspaceId, body.sessionId, {
          contactId: body.contactId,
          referralCode: body.referralCode,
          loyaltyProgramId: body.loyaltyProgramId,
          paymentMethod: body.paymentMethod,
          idempotencyKey: body.idempotencyKey,
        });
      case "void":
        return voidPosSession(workspaceId, body.sessionId);
      default:
        throw new Error("Unknown POS action");
    }
  });
}
