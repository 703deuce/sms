import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const form = await getPrisma().optInForm.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

    const rows = await getPrisma().formSubmission.findMany({
      where: { formId: id, workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      data: rows.map((r: {
        id: string;
        phone: string;
        contactId: string | null;
        embedHost: string | null;
        referrer: string | null;
        ipAddress: string | null;
        payload: unknown;
        createdAt: Date;
      }) => ({
        id: r.id,
        phone: r.phone,
        contactId: r.contactId,
        embedHost: r.embedHost,
        referrer: r.referrer,
        ipAddress: r.ipAddress,
        payload: r.payload,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
