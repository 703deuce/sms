import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireClientPortalSession } from "@/lib/appointments/client-portal/auth";
import { buildClientPortalWorkspace } from "@/lib/appointments/client-portal/workspace";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireClientPortalSession(request);
    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      phone?: string;
      timezone?: string;
    };

    const prisma = getPrisma();
    const patch: Record<string, unknown> = {};
    if (body.firstName !== undefined) patch.firstName = body.firstName;
    if (body.lastName !== undefined) patch.lastName = body.lastName;
    if (body.timezone !== undefined) patch.timezone = body.timezone;
    if (body.phone?.trim()) {
      const phone = normalizeE164(body.phone.trim());
      const conflict = await prisma.contact.findFirst({
        where: { workspaceId: ctx.workspaceId, phone, NOT: { id: ctx.contactId } },
      });
      if (conflict) return NextResponse.json({ error: "Phone already in use" }, { status: 409 });
      patch.phone = phone;
    }

    await prisma.contact.update({
      where: { id: ctx.contactId },
      data: patch,
    });

    const data = await buildClientPortalWorkspace(ctx);
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Save failed";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    return jsonError(err, 400);
  }
}
