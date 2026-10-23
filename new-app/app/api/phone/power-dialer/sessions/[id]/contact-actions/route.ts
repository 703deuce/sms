import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { skipContactInSession } from "@/lib/server/phone/power-dialer/session-orchestration";

/** In-session contact / number management (M15). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id: sessionId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      action?: string;
      contactId?: string;
      phone?: string;
    };
    const contactId = String(body.contactId || "");
    if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });

    const prisma = getPrisma();
    const contact = await prisma.contact.findFirst({ where: { id: contactId, workspaceId } });
    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const cf =
      contact.customFields && typeof contact.customFields === "object"
        ? { ...(contact.customFields as object) }
        : {};

    if (body.action === "remove_contact") {
      await skipContactInSession(workspaceId, sessionId, contactId);
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          customFields: {
            ...cf,
            powerDialerRemovedFromQueueAt: new Date().toISOString(),
          },
        },
      });
      return NextResponse.json({ data: { ok: true } });
    }

    if (body.action === "always_use_number" && body.phone) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          phone: body.phone,
          customFields: {
            ...cf,
            powerDialerPreferredPhone: body.phone,
          },
        },
      });
      return NextResponse.json({ data: { ok: true } });
    }

    if (body.action === "remove_number" && body.phone) {
      const phones =
        cf.altPhones && Array.isArray(cf.altPhones)
          ? (cf.altPhones as string[]).filter((p) => p !== body.phone)
          : [];
      const patch: Record<string, unknown> = { ...cf, altPhones: phones };
      if (contact.phone === body.phone && phones[0]) {
        await prisma.contact.update({
          where: { id: contactId },
          data: { phone: phones[0], customFields: patch },
        });
      } else {
        await prisma.contact.update({
          where: { id: contactId },
          data: { customFields: patch },
        });
      }
      return NextResponse.json({ data: { ok: true } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
