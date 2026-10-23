import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { withPublicApi } from "@/lib/server/phone/power-dialer/public-api/http";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: listId } = await ctx.params;
  return withPublicApi(request, "lists:write", async (auth) => {
    const body = (await request.json()) as { contactId?: string };
    if (!body.contactId) {
      return NextResponse.json(
        { error: { code: "validation", message: "contactId is required" } },
        { status: 400 },
      );
    }
    const prisma = getPrisma();
    const list = await prisma.contactList.findFirst({
      where: { id: listId, workspaceId: auth.workspaceId },
    });
    if (!list) {
      return NextResponse.json({ error: { code: "not_found", message: "List not found" } }, { status: 404 });
    }
    await prisma.contactListMember.upsert({
      where: { listId_contactId: { listId, contactId: body.contactId } },
      create: { listId, contactId: body.contactId },
      update: {},
    });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: listId } = await ctx.params;
  return withPublicApi(request, "lists:write", async (auth) => {
    const url = new URL(request.url);
    const contactId = url.searchParams.get("contactId");
    if (!contactId) {
      return NextResponse.json(
        { error: { code: "validation", message: "contactId query param required" } },
        { status: 400 },
      );
    }
    const prisma = getPrisma();
    await prisma.contactListMember.deleteMany({
      where: { listId, contactId, list: { workspaceId: auth.workspaceId } },
    });
    return NextResponse.json({ ok: true });
  });
}
