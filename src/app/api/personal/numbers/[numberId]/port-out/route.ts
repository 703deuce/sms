import { NextResponse } from "next/server";
import { requireWorkspaceFeature, jsonError } from "@/lib/api-auth";
import {
  revealPersonalPortOutCredentials,
  setPersonalPortOutPin,
  syncPersonalPortOutFromProvider,
} from "@/lib/numbers/personal-port-out-service";
import { buildCustomerPortOutPacket } from "@/lib/numbers/port-out-service";
import { syncTelnyxPortOutOrdersForNumber } from "@/lib/numbers/telnyx-port-out-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireWorkspaceFeature("port_out");
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const packet = await buildCustomerPortOutPacket(
      auth.workspaceId,
      numberId,
      auth.session.userId,
    );
    return NextResponse.json({ data: packet });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireWorkspaceFeature("port_out");
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const body = (await request.json()) as {
      action?: "sync" | "unlock" | "lock" | "set_pin";
      pin?: string;
    };

    if (body.action === "sync") {
      const data = await syncPersonalPortOutFromProvider(auth.workspaceId, numberId);
      if (data.provider === "telnyx") {
        await syncTelnyxPortOutOrdersForNumber(auth.workspaceId, numberId).catch(() => undefined);
      }
      const packet = await buildCustomerPortOutPacket(
        auth.workspaceId,
        numberId,
        auth.session.userId,
      );
      return NextResponse.json({ data: { ...data, packet } });
    }

    if (body.action === "unlock") {
      const data = await setPersonalPortOutPin(auth.workspaceId, numberId, body.pin || "", false);
      const packet = await buildCustomerPortOutPacket(
        auth.workspaceId,
        numberId,
        auth.session.userId,
      );
      return NextResponse.json({ data: { ...data, packet } });
    }

    if (body.action === "lock") {
      const data = await setPersonalPortOutPin(
        auth.workspaceId,
        numberId,
        body.pin || "",
        true,
      );
      return NextResponse.json({ data, locked: true });
    }

    if (body.action === "set_pin" && body.pin?.trim()) {
      const data = await setPersonalPortOutPin(
        auth.workspaceId,
        numberId,
        body.pin.trim(),
        false,
      );
      const packet = await buildCustomerPortOutPacket(
        auth.workspaceId,
        numberId,
        auth.session.userId,
      );
      return NextResponse.json({ data: { ...data, packet } });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
