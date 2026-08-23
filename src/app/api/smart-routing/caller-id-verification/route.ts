import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  getCallerIdVerificationStatus,
  startCallerIdVerification,
  submitCallerIdVerificationCode,
} from "@/lib/smart-routing/caller-id-verification";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await getCallerIdVerificationStatus(auth.workspaceId);
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
    const action = String(body.action || "start");

    if (action === "start") {
      const method = body.method === "call" ? "call" : "sms";
      const data = await startCallerIdVerification({
        workspaceId: auth.workspaceId,
        phoneE164: String(body.phoneE164 || ""),
        method,
      });
      return NextResponse.json({ data });
    }

    if (action === "submit_code") {
      const data = await submitCallerIdVerificationCode({
        workspaceId: auth.workspaceId,
        code: String(body.code || ""),
      });
      return NextResponse.json({ data });
    }

    return jsonError(new Error("Unknown action"), 400);
  } catch (err) {
    return jsonError(err, 400);
  }
}
