import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import {
  assignNumberToCampaignAndReady,
  inventoryTenDlc,
  sendTenDlcTestSms,
} from "@/lib/messaging/telnyx/ten-dlc-ops";

/**
 * 10DLC inventory + number→campaign assignment for compliance UI / ops.
 *
 * GET  → list brands, campaigns, numbers, assignments
 * POST { action: "inventory" }
 * POST { action: "assign", phoneE164, campaignId?, brandId?, messagingProfileId? }
 * POST { action: "send_test", to, body?, from? }
 */
export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    await resolveWorkspaceId(auth.session, url.searchParams.get("workspaceId"));
    const data = await inventoryTenDlc();
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const workspaceId = await resolveWorkspaceId(
      auth.session,
      typeof body.workspaceId === "string" ? body.workspaceId : undefined,
    );
    const action = String(body.action || "inventory");

    if (action === "inventory") {
      const data = await inventoryTenDlc();
      return NextResponse.json({ data });
    }

    if (action === "assign") {
      const phoneE164 = String(body.phoneE164 || body.phone || body.from || "");
      if (!phoneE164) {
        return NextResponse.json({ error: "phoneE164 is required" }, { status: 400 });
      }
      const data = await assignNumberToCampaignAndReady({
        workspaceId,
        phoneE164,
        campaignId:
          typeof body.campaignId === "string" ? body.campaignId : undefined,
        brandId: typeof body.brandId === "string" ? body.brandId : undefined,
        messagingProfileId:
          typeof body.messagingProfileId === "string"
            ? body.messagingProfileId
            : undefined,
        providerNumberId:
          typeof body.providerNumberId === "string"
            ? body.providerNumberId
            : undefined,
      });
      return NextResponse.json({ data });
    }

    if (action === "send_test") {
      const to = String(body.to || body.customerPhone || "");
      if (!to) {
        return NextResponse.json({ error: "to is required" }, { status: 400 });
      }
      const data = await sendTenDlcTestSms({
        workspaceId,
        to,
        body: typeof body.body === "string" ? body.body : undefined,
        from: typeof body.from === "string" ? body.from : undefined,
      });
      return NextResponse.json({ data });
    }

    return NextResponse.json(
      { error: "action must be inventory | assign | send_test" },
      { status: 400 },
    );
  } catch (err) {
    return jsonError(err, 400);
  }
}
