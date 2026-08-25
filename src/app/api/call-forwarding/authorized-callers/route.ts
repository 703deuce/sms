import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  listCallForwardingAuthorizedCallers,
  upsertCallForwardingAuthorizedCaller,
  deleteCallForwardingAuthorizedCaller,
} from "@/lib/call-forwarding/authorized-callers";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    if (!(await hasWorkspaceProductFeature(auth.workspaceId, "call_forwarding"))) {
      return NextResponse.json({ error: "Call Forwarding subscription required" }, { status: 403 });
    }
    const data = await listCallForwardingAuthorizedCallers(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    if (!(await hasWorkspaceProductFeature(auth.workspaceId, "call_forwarding"))) {
      return NextResponse.json({ error: "Call Forwarding subscription required" }, { status: 403 });
    }
    const body = await req.json();
    const row = await upsertCallForwardingAuthorizedCaller({
      workspaceId: auth.workspaceId,
      name: String(body.name || "Team member"),
      phoneE164: String(body.phoneE164 || ""),
      active: body.active !== false,
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteCallForwardingAuthorizedCaller(auth.workspaceId, String(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
