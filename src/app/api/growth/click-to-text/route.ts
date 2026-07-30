import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { buildClickToTextHref } from "@/lib/growth/click-to-text";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await getPrisma().clickToTextLink.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      phoneE164?: string;
      body?: string;
    };
    const name = (body.name || "").trim();
    const textBody = (body.body || "JOIN").trim();
    if (!name || !body.phoneE164) {
      return NextResponse.json({ error: "name and phoneE164 are required" }, { status: 400 });
    }
    const phoneE164 = normalizeE164(body.phoneE164);
    const href = buildClickToTextHref(phoneE164, textBody);
    const created = await getPrisma().clickToTextLink.create({
      data: {
        workspaceId: auth.workspaceId,
        name,
        phoneE164,
        body: textBody,
        href,
        status: "Active",
      },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
