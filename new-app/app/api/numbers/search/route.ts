import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { searchAvailableNumbers } from "@/lib/server/telnyx/numbers";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      areaCode?: string;
      city?: string;
      contains?: string;
      numberType?: "local" | "toll_free";
    };

    const results = await searchAvailableNumbers({
      areaCode: body.areaCode,
      locality: body.city,
      contains: body.contains,
      tollFree: body.numberType === "toll_free",
    });

    const data = results.map((n) => ({
      e164: n.phoneNumber,
      region: n.region || n.locality || "US",
      monthly: n.phoneNumber.startsWith("+1800") || n.phoneNumber.startsWith("+1888") ? 2 : 1.15,
      setupFee: 0,
      capabilities: n.capabilities,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
