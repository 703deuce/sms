import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createEmployeeAccessToken,
  listEmployeeAccessTokens,
  revokeEmployeeAccessToken,
} from "@/lib/smart-routing/employee-access-token-service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await listEmployeeAccessTokens(auth.workspaceId);
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
    return NextResponse.json({
      data: rows.map((r: {
        id: string;
        label: string | null;
        expiresAt: Date;
        lastUsedAt: Date | null;
        authorizedCaller?: { name: string } | null;
      }) => ({
        id: r.id,
        label: r.label,
        expiresAt: r.expiresAt,
        lastUsedAt: r.lastUsedAt,
        authorizedCallerName: r.authorizedCaller?.name,
        // Links are shown only at creation time (token not stored plaintext)
      })),
      baseUrl: base.replace(/\/$/, ""),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const authorizedCallerId = String(body.authorizedCallerId || "").trim();
    if (!authorizedCallerId) return jsonError(new Error("authorizedCallerId required"), 400);

    const result = await createEmployeeAccessToken({
      workspaceId: auth.workspaceId,
      authorizedCallerId,
      label: body.label ? String(body.label) : null,
      ttlDays: body.ttlDays ? Number(body.ttlDays) : undefined,
    });

    const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
    return NextResponse.json({
      data: {
        id: result.id,
        expiresAt: result.expiresAt,
        url: `${base}/e/call/${result.token}`,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError(new Error("id required"), 400);
    await revokeEmployeeAccessToken(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
