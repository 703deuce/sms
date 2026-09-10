import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveClientPortalSession } from "@/lib/appointments/service-booking";
import {
  portalCancelMembership,
  portalPauseMembership,
  portalResumeMembership,
  portalRetryMembershipPayment,
  portalUndoMembershipCancellation,
} from "@/lib/appointments/service-booking/portal-membership-actions";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveClientPortalSession(token);
    if (!resolved) {
      return NextResponse.json({ error: "Invalid or expired portal session" }, { status: 404 });
    }

    const body = (await request.json()) as {
      action?: string;
      subscriptionId?: string;
      mode?: "immediate" | "end_of_period";
      pausedUntil?: string;
    };

    const subscriptionId = String(body.subscriptionId || "");
    if (!subscriptionId) {
      return NextResponse.json({ error: "subscriptionId required" }, { status: 400 });
    }

    const { workspaceId, contactId } = resolved.session;
    const action = String(body.action || "");

    if (action === "cancel") {
      const mode = body.mode === "immediate" ? "immediate" : "end_of_period";
      const sub = await portalCancelMembership({
        workspaceId,
        contactId,
        subscriptionId,
        mode,
      });
      return NextResponse.json({ data: { subscription: sub } });
    }

    if (action === "undo_cancel") {
      const sub = await portalUndoMembershipCancellation({
        workspaceId,
        contactId,
        subscriptionId,
      });
      return NextResponse.json({ data: { subscription: sub } });
    }

    if (action === "pause") {
      const sub = await portalPauseMembership({
        workspaceId,
        contactId,
        subscriptionId,
        pausedUntil: body.pausedUntil,
      });
      return NextResponse.json({ data: { subscription: sub } });
    }

    if (action === "resume") {
      const sub = await portalResumeMembership({
        workspaceId,
        contactId,
        subscriptionId,
      });
      return NextResponse.json({ data: { subscription: sub } });
    }

    if (action === "retry_payment") {
      const result = await portalRetryMembershipPayment({
        workspaceId,
        contactId,
        subscriptionId,
      });
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
