/**
 * Certification-only SMS send — gated by smoke bootstrap token (not a public bypass).
 * Uses platform messaging registration so cert workspaces can send from HP +15714073615.
 */
import { NextResponse } from "next/server";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { HP_CERTIFIED_SMS_E164 } from "@/lib/messaging/preferred-sending-number";

const BOOTSTRAP_VALUE = "transovo-smoke-bootstrap-b56f-aug2026";

function authorized(request: Request): boolean {
  const token = request.headers.get("x-smoke-bootstrap") || "";
  return token === BOOTSTRAP_VALUE;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      workspaceId?: string;
      to?: string;
      message?: string;
      body?: string;
    };
    const workspaceId = body.workspaceId?.trim();
    const to = body.to?.trim();
    const text = (body.message || body.body || "").trim();

    if (!workspaceId || !to || !text) {
      return NextResponse.json(
        { error: "workspaceId, to, and message are required" },
        { status: 400 },
      );
    }

    const result = await sendQuickSms({
      workspaceId,
      to,
      body: text,
      from: HP_CERTIFIED_SMS_E164,
      demoBypass: true,
      idempotencyKey: `cert-sms:${workspaceId}:${Date.now()}`,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
