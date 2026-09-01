import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { estimateFaxSend } from "@/lib/fax/fax-send-estimate";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const form = await request.formData();
    const file = form.get("document");
    if (!(file instanceof File)) return jsonError(new Error("PDF document is required"), 400);

    const bytes = Buffer.from(await file.arrayBuffer());
    const data = await estimateFaxSend({ workspaceId: auth.workspaceId, documentBytes: bytes });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err);
  }
}
