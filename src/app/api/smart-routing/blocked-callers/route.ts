import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  blockCallerForSmartRouting,
  listBlockedCallerE164,
  unblockCallerForSmartRouting,
} from "@/lib/smart-routing/blocked-callers";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const blocked = await listBlockedCallerE164(auth.workspaceId);
    return NextResponse.json({ data: blocked });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const phone = String(body.phoneE164 || body.callerE164 || "");
    if (!phone) return jsonError(new Error("phoneE164 required"), 400);
    const blocked = await blockCallerForSmartRouting(auth.workspaceId, phone);
    return NextResponse.json({ data: blocked });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const phone = url.searchParams.get("phoneE164") || url.searchParams.get("callerE164") || "";
    if (!phone) return jsonError(new Error("phoneE164 required"), 400);
    const blocked = await unblockCallerForSmartRouting(auth.workspaceId, phone);
    return NextResponse.json({ data: blocked });
  } catch (err) {
    return jsonError(err, 400);
  }
}
