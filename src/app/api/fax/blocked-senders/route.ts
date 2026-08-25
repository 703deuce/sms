import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  blockFaxSender,
  listBlockedSenders,
  unblockFaxSender,
} from "@/lib/fax/fax-blocked-senders";
import { normalizeVerifyPhone } from "@/lib/verify/phone-normalization";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listBlockedSenders(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const raw = String(body.faxE164 || body.phone || "").trim();
    const norm = normalizeVerifyPhone(raw);
    if (!norm.ok) return jsonError(new Error("Invalid fax number"), 400);
    const data = await blockFaxSender({
      workspaceId: auth.workspaceId,
      faxE164: norm.e164,
      reason: body.reason || "Blocked manually",
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const faxE164 = new URL(request.url).searchParams.get("faxE164");
    if (!faxE164) return jsonError(new Error("faxE164 is required"), 400);
    const norm = normalizeVerifyPhone(faxE164);
    if (!norm.ok) return jsonError(new Error("Invalid fax number"), 400);
    await unblockFaxSender(auth.workspaceId, norm.e164);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
