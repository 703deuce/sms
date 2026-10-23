import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getContactListDetail } from "@/lib/server/phone/power-dialer/list-detail";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const page = url.searchParams.get("page");
    const pageSize = url.searchParams.get("pageSize");
    const search = url.searchParams.get("q") ?? undefined;
    const data = await getContactListDetail(workspaceId, id, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 404);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { action?: string; filters?: unknown; basis?: string; notes?: string };
    const { archiveContactList } = await import("@/lib/server/phone/power-dialer/list-detail");
    if (body.action === "archive") {
      await archiveContactList(workspaceId, id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "save_filters") {
      const prisma = (await import("@/lib/server/db")).getPrisma();
      await prisma.contactList.updateMany({
        where: { id, workspaceId },
        data: { filtersJson: body.filters ?? [] },
      });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "save_dial_consent") {
      const prisma = (await import("@/lib/server/db")).getPrisma();
      const { resolveInternalUserId } = await import("@/lib/server/internal-user");
      const userId = await resolveInternalUserId();
      const basis = body.basis;
      if (
        basis !== "existing_permission" &&
        basis !== "lead_form" &&
        basis !== "purchased_list" &&
        basis !== "other"
      ) {
        throw new Error("Invalid consent basis");
      }
      await prisma.contactList.updateMany({
        where: { id, workspaceId },
        data: {
          dialConsentJson: {
            basis,
            notes: typeof body.notes === "string" ? body.notes : "",
            attestedAt: new Date().toISOString(),
            attestedByUserId: userId,
          },
        },
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
