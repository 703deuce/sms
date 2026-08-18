import { NextResponse } from "next/server";
import { requireWorkspaceFeature, jsonError } from "@/lib/api-auth";
import {
  getCustomerPortOutRequest,
  resolveGuaranteeChoice,
} from "@/lib/numbers/port-out-service";
import { syncTelnyxPortOutOrdersForNumber } from "@/lib/numbers/telnyx-port-out-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireWorkspaceFeature("port_out");
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const row = await getCustomerPortOutRequest(auth.workspaceId, id);
    if (!row) {
      return NextResponse.json({ error: "Port-out request not found" }, { status: 404 });
    }
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireWorkspaceFeature("port_out");
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      action?: "sync" | "guarantee_keep" | "guarantee_refund";
      phoneNumberId?: string;
      refundAcknowledged?: boolean;
    };

    if (body.action === "sync" && body.phoneNumberId) {
      const data = await syncTelnyxPortOutOrdersForNumber(
        auth.workspaceId,
        body.phoneNumberId,
      );
      const row = await getCustomerPortOutRequest(auth.workspaceId, id);
      return NextResponse.json({ data: { sync: data, request: row } });
    }

    if (body.action === "guarantee_keep") {
      const data = await resolveGuaranteeChoice({
        workspaceId: auth.workspaceId,
        portOutId: id,
        userId: auth.session.userId,
        choice: "keep",
      });
      return NextResponse.json({ data });
    }

    if (body.action === "guarantee_refund") {
      const data = await resolveGuaranteeChoice({
        workspaceId: auth.workspaceId,
        portOutId: id,
        userId: auth.session.userId,
        choice: "refund",
        refundAcknowledged: body.refundAcknowledged,
      });
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
