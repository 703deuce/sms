import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { runSingleVerify } from "@/lib/verify/verify-service";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const phone = String(body.phone || "").trim();
    if (!phone) return jsonError(new Error("Phone number is required"), 400);

    const data = await runSingleVerify({
      workspaceId: auth.workspaceId,
      phone,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
