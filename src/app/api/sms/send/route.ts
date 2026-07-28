import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { sendQuickSms } from "@/lib/sms/send-quick";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      workspaceId?: string;
      to?: string;
      customerPhone?: string;
      message?: string;
      body?: string;
      customMessage?: string;
      from?: string;
      campaignId?: string;
    };

    const workspaceId = body.workspaceId || auth.workspaceId;
    const to = body.to || body.customerPhone;
    const message = body.message || body.body || body.customMessage;

    if (!to || !message) {
      return NextResponse.json({ error: "to (or customerPhone) and message are required" }, { status: 400 });
    }

    const result = await sendQuickSms({
      workspaceId,
      to,
      body: message,
      from: body.from,
      campaignId: body.campaignId,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
