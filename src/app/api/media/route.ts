import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { normalizeMediaUrls } from "@/lib/mass-texting/mms";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await getPrisma().mediaAsset.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ data: rows });
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
      storageUrl?: string;
      assetType?: string;
      mimeType?: string;
      sizeBytes?: number;
    };
    if (!body.name?.trim() || !body.storageUrl?.trim()) {
      return NextResponse.json({ error: "name and storageUrl required" }, { status: 400 });
    }
    const [storageUrl] = normalizeMediaUrls([body.storageUrl]);
    if (!storageUrl) {
      return NextResponse.json(
        { error: "storageUrl must be a public http(s) image URL" },
        { status: 400 },
      );
    }
    const row = await getPrisma().mediaAsset.create({
      data: {
        workspaceId: auth.workspaceId,
        name: body.name.trim(),
        storageUrl,
        assetType: body.assetType || "image",
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes || 0,
        createdBy: auth.session.email,
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
