import { NextResponse } from "next/server";
import { withPublicApi, paginated } from "@/lib/server/phone/power-dialer/public-api/http";
import { addInternalDnc, listInternalDnc, removeInternalDnc } from "@/lib/server/phone/power-dialer/internal-dnc";

export async function GET(request: Request) {
  return withPublicApi(request, "dnc:read", async (ctx) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || undefined;
    const rows = await listInternalDnc(ctx.workspaceId, q);
    const page = Math.max(0, Number(url.searchParams.get("page") || 0));
    const limit = Math.min(100, Number(url.searchParams.get("limit") || 50));
    const slice = rows.slice(page * limit, page * limit + limit);
    return NextResponse.json(paginated(slice, page, limit, rows.length));
  });
}

export async function POST(request: Request) {
  return withPublicApi(request, "dnc:write", async (ctx) => {
    const body = (await request.json()) as { phone?: string; reason?: string };
    if (!body.phone?.trim()) {
      return NextResponse.json({ error: { code: "validation", message: "phone required" } }, { status: 400 });
    }
    const row = await addInternalDnc({
      workspaceId: ctx.workspaceId,
      phone: body.phone,
      reason: body.reason,
      source: "api",
    });
    return NextResponse.json({ data: row });
  });
}

export async function DELETE(request: Request) {
  return withPublicApi(request, "dnc:write", async (ctx) => {
    const url = new URL(request.url);
    const phone = url.searchParams.get("phone");
    if (!phone) {
      return NextResponse.json({ error: { code: "validation", message: "phone query required" } }, { status: 400 });
    }
    await removeInternalDnc({ workspaceId: ctx.workspaceId, phone });
    return NextResponse.json({ ok: true });
  });
}
