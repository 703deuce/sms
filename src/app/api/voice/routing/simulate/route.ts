import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { simulateRouting } from "@/lib/voice/routing";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      fromE164?: string;
      toE164?: string;
      contactId?: string;
    };
    if (!body.fromE164 || !body.toE164) {
      return NextResponse.json({ error: "fromE164 and toE164 required" }, { status: 400 });
    }
    const result = await simulateRouting(auth.workspaceId, {
      fromE164: body.fromE164,
      toE164: body.toE164,
      contactId: body.contactId,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
