import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { provisionFaxNumber } from "@/lib/fax/fax-number-provisioning";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const e164 = String(body.e164 || "").trim();
    const label = String(body.label || "").trim() || undefined;
    if (!e164) return jsonError(new Error("e164 is required"), 400);

    const data = await provisionFaxNumber({
      workspaceId: auth.workspaceId,
      e164,
      label,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
