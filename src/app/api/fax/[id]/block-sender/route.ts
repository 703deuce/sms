import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getFaxTransmission } from "@/lib/fax/fax-service";
import { blockFaxSender } from "@/lib/fax/fax-blocked-senders";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const fax = await getFaxTransmission(auth.workspaceId, id);
    if (!fax) return jsonError(new Error("Fax not found"), 404);
    if (!fax.fromE164) return jsonError(new Error("No sender number on this fax"), 400);

    const data = await blockFaxSender({
      workspaceId: auth.workspaceId,
      faxE164: fax.fromE164,
      reason: "Blocked from inbound fax",
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
