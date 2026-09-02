import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { generateListGrowthPublicSlug } from "@/lib/growth/tap-to-join";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";

function buildQrImageUrl(data: string, color?: string) {
  const params = new URLSearchParams({ size: "512x512", data });
  const normalized = color?.replace("#", "").trim();
  if (normalized) params.set("color", normalized);
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const base = getAppBaseUrl();
    const rows = await getPrisma().qrCode.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
    });
    const data = rows.map((qr) => ({
      ...qr,
      trackedUrl: qr.publicSlug ? `${base}/q/${qr.publicSlug}` : qr.targetUrl,
      qrImageUrl: buildQrImageUrl(qr.publicSlug ? `${base}/q/${qr.publicSlug}` : qr.targetUrl),
    }));
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
      targetType?: string;
      targetUrl?: string;
      color?: string;
    };
    const name = (body.name || "").trim();
    const targetUrl = (body.targetUrl || "").trim();
    if (!name || !targetUrl) {
      return NextResponse.json({ error: "name and targetUrl are required" }, { status: 400 });
    }
    const publicSlug = generateListGrowthPublicSlug("q");
    const base = getAppBaseUrl();
    const trackedUrl = `${base}/q/${publicSlug}`;
    const created = await getPrisma().qrCode.create({
      data: {
        workspaceId: auth.workspaceId,
        name,
        targetType: body.targetType || "url",
        targetUrl,
        publicSlug,
        status: "Active",
      },
    });
    return NextResponse.json(
      { data: { ...created, trackedUrl, qrImageUrl: buildQrImageUrl(trackedUrl, body.color) } },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err, 400);
  }
}
