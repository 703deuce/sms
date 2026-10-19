import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { jsonError } from "@/lib/server/api-error";
import { mapPhoneRowToOwned } from "@/lib/server/numbers/map-owned";
import { orderPhoneNumber } from "@/lib/server/telnyx/numbers";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      phoneNumber?: string;
      nickname?: string;
    };
    const phoneNumber = body.phoneNumber?.trim();
    if (!phoneNumber) {
      return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
    }

    const workspaceId = await resolveWorkspaceId();
    const ordered = await orderPhoneNumber(phoneNumber, workspaceId);

    const digits = ordered.e164.replace(/\D/g, "");
    const areaCode = digits.length >= 10 ? digits.slice(-10, -7) : null;
    const tollFree = ordered.e164.includes("800") || ordered.e164.includes("888");

    const row = await getPrisma().phoneNumber.upsert({
      where: { workspaceId_e164: { workspaceId, e164: ordered.e164 } },
      create: {
        workspaceId,
        e164: ordered.e164,
        type: tollFree ? "Toll-free" : "Local",
        areaCode,
        friendlyName: body.nickname?.trim() || ordered.e164,
        provider: "telnyx",
        providerNumberId: ordered.providerNumberId,
        providerOrderId: ordered.orderId,
        status: ordered.providerNumberId ? "Active" : "Pending",
        purchasedAt: new Date(),
        capabilitiesJson: { voice: true, sms: true, mms: false },
      },
      update: {
        friendlyName: body.nickname?.trim() || undefined,
        providerNumberId: ordered.providerNumberId || undefined,
        providerOrderId: ordered.orderId,
      },
    });

    return NextResponse.json({ data: mapPhoneRowToOwned(row) });
  } catch (err) {
    return jsonError(err, 500);
  }
}
