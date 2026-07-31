import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { composeCampaignMessages } from "@/lib/ai/campaign-composer";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    const data = composeCampaignMessages({
      goal: String(body.goal || ""),
      audience: String(body.audience || ""),
      tone: String(body.tone || ""),
      offer: String(body.offer || ""),
      businessName: String(body.businessName || ""),
      includeLink: Boolean(body.includeLink),
      destinationUrl: String(body.destinationUrl || ""),
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
