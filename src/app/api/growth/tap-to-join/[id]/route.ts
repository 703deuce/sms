import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  buildTapToJoinButtonHtml,
  buildTapToJoinPublicUrl,
  getTapToJoinLink,
  updateTapToJoinLink,
} from "@/lib/growth/tap-to-join";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const data = await getTapToJoinLink(auth.workspaceId, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const publicUrl = data.publicSlug ? buildTapToJoinPublicUrl(data.publicSlug) : data.href;
    return NextResponse.json({
      data: {
        ...data,
        publicUrl,
        buttonHtml: buildTapToJoinButtonHtml(publicUrl, data.buttonText),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      keywordId?: string;
      phoneNumberId?: string | null;
      buttonText?: string;
      status?: string;
    };
    const data = await updateTapToJoinLink(auth.workspaceId, id, body);
    const publicUrl = data?.publicSlug ? buildTapToJoinPublicUrl(data.publicSlug) : data?.href;
    return NextResponse.json({
      data: data
        ? {
            ...data,
            publicUrl,
            buttonHtml: buildTapToJoinButtonHtml(publicUrl || "", data.buttonText),
          }
        : null,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const existing = await getPrisma().clickToTextLink.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().clickToTextLink.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
