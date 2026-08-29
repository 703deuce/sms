import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { createTapToJoinLink, listTapToJoinLinks } from "@/lib/growth/tap-to-join";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listTapToJoinLinks(auth.workspaceId);
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
      keywordId?: string;
      phoneNumberId?: string | null;
      phoneE164?: string;
      buttonText?: string;
      status?: string;
    };
    if (!body.name?.trim() || !body.keywordId) {
      return NextResponse.json({ error: "name and keywordId are required" }, { status: 400 });
    }
    const data = await createTapToJoinLink(auth.workspaceId, {
      name: body.name,
      keywordId: body.keywordId,
      phoneNumberId: body.phoneNumberId,
      phoneE164: body.phoneE164,
      buttonText: body.buttonText,
      status: body.status,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
