import { NextResponse } from "next/server";
import { requireWorkspaceFeature, jsonError } from "@/lib/api-auth";
import {
  PORT_OUT_DESTINATION_RULES,
} from "@/lib/numbers/port-out-destination-rules";
import {
  initiatePortOutTransfer,
  listCustomerPortOutRequests,
} from "@/lib/numbers/port-out-service";

export async function GET() {
  try {
    const auth = await requireWorkspaceFeature("port_out");
    if ("error" in auth) return auth.error;

    const requests = await listCustomerPortOutRequests(auth.workspaceId);
    return NextResponse.json({
      data: {
        requests,
        destinations: PORT_OUT_DESTINATION_RULES.map((d) => ({
          value: d.destination,
          label: d.label,
          warningType: d.warningType,
          warningMessage: d.warningMessage,
          directPortSupport: d.directPortSupport,
          requiresCompatibilityCheck: d.requiresCompatibilityCheck,
          intermediaryRequired: d.intermediaryRequired,
        })),
        promise: "Your number. Use it where you want.",
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireWorkspaceFeature("port_out");
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      phoneNumberId?: string;
      destinationType?: string;
      destinationCarrier?: string;
      authorizedContactEmail?: string;
      authorizedContactName?: string;
      authorizedContactPhone?: string;
      preferredTransferDate?: string;
    };

    if (!body.phoneNumberId?.trim()) {
      return NextResponse.json({ error: "phoneNumberId required" }, { status: 400 });
    }
    if (!body.destinationType?.trim()) {
      return NextResponse.json({ error: "destinationType required" }, { status: 400 });
    }

    const result = await initiatePortOutTransfer({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      phoneNumberId: body.phoneNumberId.trim(),
      destinationType: body.destinationType.trim(),
      destinationCarrier: body.destinationCarrier,
      authorizedContactEmail: body.authorizedContactEmail,
      authorizedContactName: body.authorizedContactName,
      authorizedContactPhone: body.authorizedContactPhone,
      preferredTransferDate: body.preferredTransferDate,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
