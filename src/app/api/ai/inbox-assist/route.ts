import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { analyzeInboxThread } from "@/lib/ai/inbox-assistant";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      messages?: Array<{ direction: string; body: string }>;
      contactName?: string;
    };
    const messages = (body.messages || []).map((m) => ({
      direction: (m.direction === "inbound" || m.direction === "outbound" || m.direction === "note"
        ? m.direction
        : "inbound") as "inbound" | "outbound" | "note",
      body: m.body || "",
    }));
    const data = analyzeInboxThread(messages, body.contactName);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
