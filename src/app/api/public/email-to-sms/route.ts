import { NextResponse } from "next/server";
import { processEmailToSmsInbound } from "@/lib/email-to-sms/process";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      to?: string;
      from?: string;
      subject?: string;
      text?: string;
    };
    if (!body.to?.trim()) {
      return NextResponse.json({ error: "to required" }, { status: 400 });
    }
    const result = await processEmailToSmsInbound({
      to: body.to,
      from: body.from || "unknown",
      subject: body.subject,
      text: body.text,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error("[public/email-to-sms]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 },
    );
  }
}
