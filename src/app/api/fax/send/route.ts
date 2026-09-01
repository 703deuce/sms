import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { sendOutboundFax } from "@/lib/fax/fax-service";
import { getPrimaryFaxNumber } from "@/lib/fax/fax-number-provisioning";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const form = await request.formData();
    const toE164 = String(form.get("toE164") || form.get("to") || "").trim();
    const fromE164 = String(form.get("fromE164") || "").trim();
    const recipientName = String(form.get("recipientName") || "").trim() || undefined;
    const scheduledForRaw = String(form.get("scheduledFor") || "").trim();
    const file = form.get("document");

    if (!toE164) return jsonError(new Error("Destination fax number is required"), 400);
    if (!(file instanceof File)) return jsonError(new Error("PDF document is required"), 400);

    const faxNumber = fromE164
      ? { e164: fromE164 }
      : await getPrimaryFaxNumber(auth.workspaceId);
    if (!faxNumber?.e164) {
      return jsonError(new Error("No active fax number — complete fax setup first"), 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const scheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : null;

    const transmission = await sendOutboundFax({
      workspaceId: auth.workspaceId,
      fromE164: faxNumber.e164,
      toE164,
      documentBytes: bytes,
      mimeType: file.type || "application/pdf",
      filename: file.name,
      recipientName,
      userId: auth.session.userId,
      scheduledFor,
    });

    return NextResponse.json({ data: transmission });
  } catch (err) {
    return jsonError(err);
  }
}
